import makeDebug from 'debug';
import { format } from 'util';

const todo = makeDebug('embroider:todo');
const unsupported = makeDebug('embroider:unsupported');
const debug = makeDebug('embroider:debug');

function realWarn(message: string, ...params: any[]) {
  console.log('WARNING: ' + format(message, ...params));
}

let expectStack = [] as RegExp[];
let handled: WeakSet<RegExp> = new WeakSet();

function expectedWarn(message: string, ...params: any[]) {
  let formattedMessage = format(message, ...params);
  for (let pattern of expectStack) {
    if (pattern.test(formattedMessage)) {
      handled.add(pattern);
      return;
    }
  }
  realWarn(message, ...params);
}

export function warn(message: string, ...params: any[]) {
  if (expectStack.length === 0) {
    realWarn(message, params);
  } else {
    expectedWarn(message, params);
  }
}

export function expectWarning(pattern: RegExp, fn: () => void) {
  expectStack.push(pattern);
  try {
    fn();
  } finally {
    expectStack.pop();
  }
  return handled.has(pattern);
}

export { todo, unsupported, debug };
