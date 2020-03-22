import { format } from 'util';
import evaluate from './evaluate';

export function failBuild(node: any) {
  if (node.params.length < 1) {
    throw new Error(`macroFailBuild requires at least one argument`);
  }

  let values = node.params.map(evaluate);
  for (let i = 0; i < values.length; i++) {
    if (!values[i].confident) {
      throw new Error(`argument ${i} to macroFailBuild is not statically analyzable`);
    }
  }
  let [message, ...rest] = values;
  throw new Error(format(`failBuild: ${message.value}`, ...rest.map((r: any) => r.value)));
}
