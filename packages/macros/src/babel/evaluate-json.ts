import { NodePath } from '@babel/traverse';
import getConfig from './get-config';
import State from './state';
import { PackageCache } from '@embroider/core';
import dependencySatisfies from './dependency-satisfies';

function evaluateKey(path: NodePath, state: State, packageCache: PackageCache): { confident: boolean, value: any } {
  let first = evaluateJSON(path, state, packageCache);
  if (first.confident) {
    return first;
  }
  if (path.isIdentifier()) {
    return { confident: true, value: path.node.name };
  }
  return { confident: false, value: undefined };
}

export default function evaluateJSON(path: NodePath, state: State, packageCache: PackageCache): { confident: boolean, value: any } {
  if (path.isMemberExpression()) {
    let property = evaluateKey(assertNotArray(path.get('property')), state, packageCache);
    if (property.confident) {
      let object = evaluateJSON(path.get('object'), state, packageCache);
      if (object.confident) {
        return { confident: true, value: object.value[property.value] };
      }
    }
  }

  if (path.isStringLiteral()) {
    return { confident: true, value: path.node.value };
  }

  if (path.isNumericLiteral()) {
    return { confident: true, value: path.node.value };
  }

  if (path.isBooleanLiteral()) {
    return { confident: true, value: path.node.value };
  }

  if (path.isNullLiteral()) {
    return { confident: true, value: null };
  }

  if (path.isObjectExpression()) {
    let props = assertArray(path.get('properties')).map(p => [ evaluateJSON(assertNotArray(p.get('key')), state, packageCache), evaluateJSON(assertNotArray(p.get('value')), state, packageCache) ]);
    let result: any = {};
    for (let [k,v] of props) {
      if (!k.confident || !v.confident) {
        return { confident: false, value: undefined };
      }
      result[k.value] = v.value;
    }
    return { confident: true, value: result };
  }

  if (path.isArrayExpression()) {
    let elements = path.get('elements').map(element => {
      return evaluateJSON(element as NodePath, state, packageCache);
    });
    if (elements.every(element => element.confident)) {
      return { confident: true, value: elements.map(element => element.value) };
    }
  }

  if (path.isCallExpression()) {
    let callee = path.get('callee');
    if (callee.isIdentifier()) {
      if (callee.referencesImport('@embroider/macros', 'getConfig')) {
        getConfig(path, state, packageCache, false);
        return evaluateJSON(path, state, packageCache);
      }
      if (callee.referencesImport('@embroider/macros', 'getOwnConfig')) {
        getConfig(path, state, packageCache, true);
        return evaluateJSON(path, state, packageCache);
      }
      if (callee.referencesImport('@embroider/macros', 'dependencySatisfies')) {
        dependencySatisfies(path, state, packageCache);
        return evaluateJSON(path, state, packageCache);
      }
    }
  }

  return { confident: false, value: undefined };
}

// these are here because the type definitions we're using don't seem to know
// exactly which NodePath properties are arrays and which aren't.

export function assertNotArray<T>(input: T | T[]): T {
  if (Array.isArray(input)) {
    throw new Error(`bug: not supposed to be an array`);
  }
  return input;
}

export function assertArray<T>(input: T | T[]): T[] {
  if (!Array.isArray(input)) {
    throw new Error(`bug: supposed to be an array`);
  }
  return input;
}
