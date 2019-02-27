import { NodePath } from '@babel/traverse';

export default function evaluateJSON(path: NodePath): { confident: boolean, value: any } {
  if (path.isMemberExpression()) {
    let property = evaluateJSON(assertNotArray(path.get('property')));
    if (property.confident) {
      let object = evaluateJSON(path.get('object'));
      if (object.confident) {
        return { confident: true, value: object.value[property.value] };
      }
    }
  }

  if (path.isIdentifier()) {
    return { confident: true, value: path.node.name };
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

  if (path.isObjectExpression()) {
    let props = assertArray(path.get('properties')).map(p => [ evaluateJSON(assertNotArray(p.get('key'))), evaluateJSON(assertNotArray(p.get('value'))) ]);
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
      return evaluateJSON(element as NodePath);
    });
    if (elements.every(element => element.confident)) {
      return { confident: true, value: elements.map(element => element.value) };
    }
  }

  return { confident: false, value: undefined };
}

// these are here because the type definitions we're using don't seem to know
// exactly which NodePath properties are arrays and which aren't.

function assertNotArray<T>(input: T | T[]): T {
  if (Array.isArray(input)) {
    throw new Error(`bug: not supposed to be an array`);
  }
  return input;
}

function assertArray<T>(input: T | T[]): T[] {
  if (!Array.isArray(input)) {
    throw new Error(`bug: supposed to be an array`);
  }
  return input;
}
