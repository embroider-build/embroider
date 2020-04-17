import { NodePath } from '@babel/traverse';
import {
  Identifier,
  ObjectExpression,
  identifier,
  MemberExpression,
  Expression,
  File,
  ExpressionStatement,
  CallExpression,
} from '@babel/types';
import { parse } from '@babel/core';

type OpValue = string | boolean | number;

const binops: { [operator: string]: any } = {
  '||': function(a: OpValue, b: OpValue) {
    return a || b;
  },
  '&&': function(a: OpValue, b: OpValue) {
    return a && b;
  },
  '|': function(a: any, b: any) {
    return a | b;
  },
  '^': function(a: any, b: any) {
    return a ^ b;
  },
  '&': function(a: any, b: any) {
    return a & b;
  },
  '==': function(a: OpValue, b: OpValue) {
    // eslint-disable-next-line eqeqeq
    return a == b;
  },
  '!=': function(a: OpValue, b: OpValue) {
    // eslint-disable-next-line eqeqeq
    return a != b;
  },
  '===': function(a: OpValue, b: OpValue) {
    return a === b;
  },
  '!==': function(a: OpValue, b: OpValue) {
    return a !== b;
  },
  '<': function(a: OpValue, b: OpValue) {
    return a < b;
  },
  '>': function(a: OpValue, b: OpValue) {
    return a > b;
  },
  '<=': function(a: OpValue, b: OpValue) {
    return a <= b;
  },
  '>=': function(a: OpValue, b: OpValue) {
    return a >= b;
  },
  '<<': function(a: any, b: any) {
    return a << b;
  },
  '>>': function(a: any, b: any) {
    return a >> b;
  },
  '>>>': function(a: any, b: any) {
    return a >>> b;
  },
  '+': function(a: any, b: any) {
    return a + b;
  },
  '-': function(a: any, b: any) {
    return a - b;
  },
  '*': function(a: any, b: any) {
    return a * b;
  },
  '/': function(a: any, b: any) {
    return a / b;
  },
  '%': function(a: any, b: any) {
    return a % b;
  },
  '??': function(a: any, b: any) {
    if (a === null || a === undefined) {
      return b;
    }
    return a;
  },
};

const unops: { [operator: string]: any } = {
  '-': function(a: OpValue) {
    return -a;
  },
  '+': function(a: OpValue) {
    return +a;
  },
  '~': function(a: OpValue) {
    return ~a;
  },
  '!': function(a: OpValue) {
    return !a;
  },
  void: function() {
    return undefined;
  },
};

export interface ConfidentResult {
  confident: true;
  value: any;
}

export interface UnknownResult {
  confident: false;
}

export type EvaluateResult = ConfidentResult | UnknownResult;

// this is needed to make our strict types work when inter-operating with
// babel's own built-in evaluator
function isConfidentResult(result: { confident: boolean; value: any }): result is ConfidentResult {
  return result.confident;
}

export function evaluate(path: NodePath): EvaluateResult {
  return new Evaluator().evaluate(path);
}

export class Evaluator {
  knownPaths: Map<NodePath, EvaluateResult> = new Map();
  context: { [localVar: string]: any } = {};

  evaluateMember(path: NodePath<MemberExpression>, optionalChain: boolean): EvaluateResult {
    let propertyPath = assertNotArray(path.get('property'));
    let property: EvaluateResult;
    if (path.node.computed) {
      property = this.evaluate(propertyPath);
    } else {
      property = this.evaluateKey(propertyPath);
    }
    if (property.confident) {
      let objectPath = path.get('object');
      let object = this.evaluate(objectPath);
      if (object.confident) {
        let confidentObject = object;
        let confidentProperty = property;
        return {
          confident: true,
          get value() {
            if (optionalChain) {
              return confidentObject.value != null
                ? confidentObject.value[confidentProperty.value]
                : confidentObject.value;
            } else {
              return confidentObject.value[confidentProperty.value];
            }
          },
        };
      }
    }
    return { confident: false };
  }

  evaluateKey(path: NodePath): EvaluateResult {
    let first = this.evaluate(path);
    if (first.confident) {
      return first;
    }
    if (path.isIdentifier()) {
      return { confident: true, value: path.node.name };
    }
    return { confident: false };
  }

  evaluate(path: NodePath): EvaluateResult {
    let known = this.knownPaths.get(path);
    if (known) {
      return known;
    }
    let result = this.realEvaluate(path);
    return result;
  }

  private realEvaluate(path: NodePath): EvaluateResult {
    let builtIn = path.evaluate();
    if (isConfidentResult(builtIn)) {
      return builtIn;
    }

    if (path.isMemberExpression()) {
      return this.evaluateMember(path, false);
    }

    // Here we are glossing over the lack of a real OptionalMemberExpression type
    // in our @babel/traverse typings.
    if (path.node.type === 'OptionalMemberExpression') {
      return this.evaluateMember(path as NodePath<MemberExpression>, true);
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
      let props = assertArray(path.get('properties')).map(p => {
        let key = assertNotArray(p.get('key'));
        let keyEvalValue = this.evaluateKey(key);
        let value = assertNotArray(p.get('value'));
        let valueEvalValue = this.evaluate(value);
        return [keyEvalValue, valueEvalValue];
      });
      for (let [k, v] of props) {
        if (!k.confident || !v.confident) {
          return { confident: false };
        }
      }
      let confidentProps = props as ConfidentResult[][];
      return {
        confident: true,
        get value() {
          let result: any = {};
          for (let [k, v] of confidentProps) {
            result[k.value] = v.value;
          }
          return result;
        },
      };
    }

    if (path.isArrayExpression()) {
      let elements = path.get('elements').map(element => {
        return this.evaluate(element as NodePath);
      });
      if (elements.every(element => element.confident)) {
        let confidentElements = elements as ConfidentResult[];
        return {
          confident: true,
          get value() {
            return confidentElements.map(element => element.value);
          },
        };
      }
    }

    if (path.isAssignmentExpression()) {
      let leftPath = path.get('left');
      let leftNode = leftPath.node as Identifier;
      let rightPath = path.get('right');
      let rightNode = rightPath.node as Identifier;
      let rightEvalValue = this.evaluate(rightPath);
      if (rightEvalValue.confident) {
        let value = this.context[rightNode.name] || rightEvalValue.value;
        this.context[leftNode.name] = value;
        return { confident: true, value };
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

    if (path.isLogicalExpression() || path.isBinaryExpression()) {
      let operator = path.node.operator as string;
      if (binops[operator]) {
        let leftOperand = this.evaluate(path.get('left') as NodePath<Expression>);
        if (leftOperand.confident) {
          let rightOperand = this.evaluate(path.get('right') as NodePath<Expression>);
          if (leftOperand.confident && rightOperand.confident) {
            let value = binops[operator](leftOperand.value, rightOperand.value);
            return { confident: true, value };
          }
        }
      }
      return { confident: false };
    }

    if (path.isConditionalExpression()) {
      let test = this.evaluate(path.get('test'));
      if (test.confident) {
        let result = test.value ? this.evaluate(path.get('consequent')) : this.evaluate(path.get('alternate'));
        if (result.confident) {
          return result;
        }
      }
    }

    if (path.isUnaryExpression()) {
      let operator = path.node.operator as string;
      if (unops[operator]) {
        let operand = this.evaluate(path.get('argument') as NodePath<Expression>);
        if (operand.confident) {
          let value = unops[operator](operand.value);
          return { confident: true, value };
        }
      }
      return { confident: false };
    }

    if (path.isIdentifier()) {
      if (!this.context.hasOwnProperty(path.node.name)) {
        return { confident: false };
      }
      return { confident: true, value: this.context[path.node.name] };
    }

    return { confident: false };
  }
}

// these next two functions are here because the type definitions we're using
// don't seem to know exactly which NodePath properties are arrays and which
// aren't.
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

export function buildLiterals(value: unknown | undefined): Identifier | ObjectExpression {
  if (typeof value === 'undefined') {
    return identifier('undefined');
  }
  let ast = parse(`a(${JSON.stringify(value)})`, {}) as File;
  let statement = ast.program.body[0] as ExpressionStatement;
  let expression = statement.expression as CallExpression;
  return expression.arguments[0] as ObjectExpression;
}
