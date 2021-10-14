import type { NodePath } from '@babel/traverse';
import { Evaluator, ConfidentResult } from './evaluate-json';
import type { types as t } from '@babel/core';
import error from './error';
import { format } from 'util';
import State from './state';

export default function failBuild(path: NodePath<t.CallExpression>, state: State) {
  let args = path.get('arguments');
  if (args.length < 1) {
    throw error(path, `failBuild needs at least one argument`);
  }

  let e = new Evaluator({ state });

  state.jobs.push(() => {
    let argValues = args.map(a => e.evaluate(a));
    for (let i = 0; i < argValues.length; i++) {
      if (!argValues[i].confident) {
        throw error(args[i], `the arguments to failBuild must be statically known`);
      }
    }
    let confidentArgValues = argValues as ConfidentResult[];

    if (!wasRemoved(path, state)) {
      maybeEmitError(path, confidentArgValues);
    }
  });
}

function maybeEmitError(path: NodePath<t.CallExpression>, argValues: { value: any }[]) {
  let [message, ...rest] = argValues;
  throw error(path, format(`failBuild: ${message.value}`, ...rest.map(r => r.value)));
}

function wasRemoved(path: NodePath, state: State) {
  return state.removed.has(path.node) || Boolean(path.findParent(p => state.removed.has(p.node)));
}
