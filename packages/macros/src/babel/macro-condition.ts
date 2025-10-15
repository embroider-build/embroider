import type { NodePath } from '@babel/traverse';
import { Evaluator } from './evaluate-json';
import type { types as t } from '@babel/core';
import error from './error';
import type State from './state';

export interface MacroCondition {
  parity: boolean;
  conditional: NodePath<t.IfStatement | t.ConditionalExpression>;
  callExpression: NodePath<t.CallExpression>;
}

export function identifyMacroConditionPath(
  path: NodePath<t.IfStatement | t.ConditionalExpression>
): MacroCondition | false {
  let parity = true;
  let test = path.get('test');

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

export default function macroCondition(macro: MacroCondition, state: State) {
  let args = macro.callExpression.get('arguments');
  if (args.length !== 1) {
    throw error(macro.conditional, `macroCondition accepts exactly one argument, you passed ${args.length}`);
  }

  let [predicatePath] = args;
  let predicate = new Evaluator({ state }).evaluate(predicatePath);
  if (!predicate.confident) {
    throw error(args[0], `the first argument to macroCondition must be statically known`);
  }

  let consequent = macro.conditional.get('consequent');
  let alternate = macro.conditional.get('alternate');

  if (state.opts.mode === 'run-time' && predicate.hasRuntimeImplementation !== false) {
    let callee = macro.conditional.get('test').get('callee');
    callee.replaceWith(state.importUtil.import(callee, state.pathToOurAddon('runtime'), 'macroCondition'));
  } else {
    let [kept, removed] =
      predicate.value === macro.parity ? [consequent.node, alternate.node] : [alternate.node, consequent.node];
    if (kept) {
      macro.conditional.replaceWith(kept);
    } else {
      macro.conditional.remove();
    }
    if (removed) {
      state.removed.add(removed);
    }
  }
}
