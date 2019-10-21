import { NodePath } from '@babel/traverse';
import { BoundVisitor } from './visitor';

function evaluateKey(path: NodePath, visitor: BoundVisitor): { confident: boolean; value: any } {
  let first = evaluateJSON(path, visitor);
  if (first.confident) {
    return first;
  }
  if (path.isIdentifier()) {
    return { confident: true, value: path.node.name };
  }
  return { confident: false, value: undefined };
}

export default function evaluate(path: NodePath, visitor: BoundVisitor) {
  let builtIn = path.evaluate();
  if (builtIn.confident) {
    return builtIn;
  }

  // we can go further than babel's evaluate() because we know that we're
  // typically used on JSON, not full Javascript.
  return evaluateJSON(path, visitor);
}

function evaluateJSON(path: NodePath, visitor: BoundVisitor): { confident: boolean; value: any } {
  if (path.isMemberExpression()) {
    let property = evaluateKey(assertNotArray(path.get('property')), visitor);
    if (property.confident) {
      let object = evaluate(path.get('object'), visitor);
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
    let props = assertArray(path.get('properties')).map(p => [
      evaluate(assertNotArray(p.get('key')), visitor),
      evaluate(assertNotArray(p.get('value')), visitor),
    ]);
    let result: any = {};
    for (let [k, v] of props) {
      if (!k.confident || !v.confident) {
        return { confident: false, value: undefined };
      }
      result[k.value] = v.value;
    }
    return { confident: true, value: result };
  }

  if (path.isArrayExpression()) {
    let elements = path.get('elements').map(element => {
      return evaluate(element as NodePath, visitor);
    });
    if (elements.every(element => element.confident)) {
      return { confident: true, value: elements.map(element => element.value) };
    }
  }

  // TODO: this can go away now that we handle conditional nodes on the exit
  // side
  if (path.isCallExpression()) {
    visitor.CallExpression(path);
    return evaluate(path, visitor);
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
