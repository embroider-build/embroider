import { NodePath } from '@babel/traverse';

function evaluateKey(path: NodePath): { confident: boolean; value: any } {
  let first = evaluateJSON(path);
  if (first.confident) {
    return first;
  }
  if (path.isIdentifier()) {
    return { confident: true, value: path.node.name };
  }
  return { confident: false, value: undefined };
}

export default function evaluate(
  path: NodePath,
  context: { [localVar: string]: any },
  knownPaths: Map<NodePath, { confident: boolean; value: unknown }>
): { confident: boolean; value: unknown } {
  let known = knownPaths.get(path);
  if (known) {
    return known;
  }

  let builtIn = path.evaluate();
  if (builtIn.confident) {
    return builtIn;
  }

  // we can go further than babel's evaluate() because we know that we're
  // typically used on JSON, not full Javascript.
  return evaluateJSON(path);
}

function evaluateJSON(path: NodePath): { confident: boolean; value: any } {
  if (path.isMemberExpression()) {
    let property = evaluateKey(assertNotArray(path.get('property')));
    if (property.confident) {
      let object = evaluate(path.get('object'));
      if (object.confident) {
        return {
          confident: true,
          get value() {
            return object.value[property.value];
          },
        };
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
      evaluate(assertNotArray(p.get('key'))),
      evaluate(assertNotArray(p.get('value'))),
    ]);
    for (let [k, v] of props) {
      if (!k.confident || !v.confident) {
        return { confident: false, value: undefined };
      }
    }
    return {
      confident: true,
      get value() {
        let result: any = {};
        for (let [k, v] of props) {
          result[k.value] = v.value;
        }
        return result;
      },
    };
  }

  if (path.isArrayExpression()) {
    let elements = path.get('elements').map(element => {
      return evaluate(element as NodePath);
    });
    if (elements.every(element => element.confident)) {
      return {
        confident: true,
        get value() {
          return elements.map(element => element.value);
        },
      };
    }
  }

  // This handles the presence of our runtime-mode getConfig functions. We want
  // to designate them as { confident: true }, because it's important that we
  // give feedback even in runtime-mode if the developer is trying to pass
  // non-static arguments somewhere they're not supposed to. But we don't
  // actually want to calculate their value here because that has been deferred
  // to runtime. That's why we've made `value` lazy. It lets us check the
  // confidence without actually forcing the value.
  if (path.isCallExpression()) {
    let callee = path.get('callee');
    if (callee.isMemberExpression()) {
      let prop = assertNotArray(callee.get('property'));
      if (prop.isIdentifier() && prop.node.name === '_runtimeGet') {
        let obj = callee.get('object');
        if (
          obj.isIdentifier() &&
          (obj.referencesImport('@embroider/macros', 'getConfig') ||
            obj.referencesImport('@embroider/macros', 'getOwnConfig'))
        ) {
          return {
            confident: true,
            get value() {
              throw new Error(`bug in @embroider/macros: didn't expect to need to evaluate this value`);
            },
          };
        }
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
