import type { NodePath } from '@babel/traverse';
import { Evaluator } from './evaluate-json';
import type { types as t } from '@babel/core';
import type * as Babel from '@babel/core';
import error from './error';
import type State from './state';

export interface MacroCondition {
  parity: boolean;
  conditional: NodePath<t.IfStatement | t.ConditionalExpression | t.LogicalExpression>;
  callExpression: NodePath<t.CallExpression>;
}

export function identifyMacroConditionPath(
  path: NodePath<t.IfStatement | t.ConditionalExpression | t.LogicalExpression>
): MacroCondition | false {
  let parity = true;
  let test: NodePath<t.Node>;

  if (path.isLogicalExpression()) {
    // `??` has no equivalent branch semantics for a boolean predicate, so we
    // leave it alone (and the ReferencedIdentifier check will flag it).
    if (path.node.operator !== '&&' && path.node.operator !== '||') {
      return false;
    }
    test = path.get('left');
  } else {
    test = (path as NodePath<t.IfStatement | t.ConditionalExpression>).get('test');
  }

  if (test.isUnaryExpression() && test.node.operator === '!') {
    parity = false;
    test = test.get('argument');
  }

  if (test.isCallExpression()) {
    let callee = test.get('callee');
    if (callee.referencesImport('@embroider/macros', 'macroCondition')) {
      return { parity, conditional: path, callExpression: test };
    }
  }
  return false;
}

export default function macroCondition(macro: MacroCondition, state: State, context: typeof Babel) {
  let args = macro.callExpression.get('arguments');
  if (args.length !== 1) {
    throw error(macro.conditional, `macroCondition accepts exactly one argument, you passed ${args.length}`);
  }

  let [predicatePath] = args;
  let predicate = new Evaluator({ state }).evaluate(predicatePath);
  if (!predicate.confident) {
    throw error(args[0], `the first argument to macroCondition must be statically known`);
  }

  if (state.opts.mode === 'run-time' && predicate.hasRuntimeImplementation !== false) {
    let callee = macro.callExpression.get('callee');
    callee.replaceWith(state.importUtil.import(callee, state.pathToOurAddon('runtime'), 'macroCondition'));
    return;
  }

  if (macro.conditional.isLogicalExpression()) {
    // Bundlers and minifiers routinely collapse
    // `macroCondition(x) ? expr : {};` statements into
    // `macroCondition(x) && expr;`, so published code can legitimately reach
    // us in this shape even though authors write the ternary/if form.
    let effectivePredicate = predicate.value === macro.parity;
    let right = macro.conditional.get('right');
    // `true && right` / `false || right` evaluate to the right operand;
    // otherwise the expression short-circuits to the predicate's value.
    let keptRight = (macro.conditional.node.operator === '&&') === effectivePredicate;
    if (keptRight) {
      macro.conditional.replaceWith(right.node);
    } else {
      state.removed.add(right.node);
      macro.conditional.replaceWith(context.types.booleanLiteral(effectivePredicate));
    }
    return;
  }

  let conditional = macro.conditional as NodePath<t.IfStatement | t.ConditionalExpression>;
  let consequent = conditional.get('consequent');
  let alternate = conditional.get('alternate');

  let [kept, removed] =
    predicate.value === macro.parity ? [consequent.node, alternate.node] : [alternate.node, consequent.node];
  if (kept) {
    conditional.replaceWith(kept);
  } else {
    conditional.remove();
  }
  if (removed) {
    state.removed.add(removed);
  }
}
