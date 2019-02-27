import { NodePath } from '@babel/traverse';
import State from './state';

export default function ifMacro(path: NodePath, state: State) {
  let parentPath = path.parentPath;
  if (!parentPath.isCallExpression()) {
    throw new Error(`You can only use ifMacro as a function call`);
  }
  let args = parentPath.get('arguments');
  if (args.length !== 2 && args.length !== 3) {
    throw new Error(`ifMacro takes tow or three arguments, you passed ${args.length}`);
  }

  let [predicatePath, consequent, alternate] = args;
  let predicate = predicatePath.evaluate();
  if (!predicate.confident) {
    throw new Error(`the first argument to ifMacro must be statically known`);
  }
  if (typeof predicate.value !== 'boolean') {
    throw new Error(`The first argument to ifMacro must have a boolean value, you passed ${predicate.value}`);
  }

  if (!consequent.isArrowFunctionExpression()) {
    throw new Error(`The second argument to ifMacro must be an arrow function expression.`);
  }

  if (alternate && !alternate.isArrowFunctionExpression()) {
    throw new Error(`The third argument to ifMacro must be an arrow function expression.`);
  }

  let [kept, dropped] = predicate.value ? [consequent, alternate] : [ alternate, consequent];
  if (kept) {
    parentPath.replaceWith(kept.get('body'));
  } else {
    parentPath.remove();
  }
  if (dropped) {
    state.removed.push(dropped);
  }
}
