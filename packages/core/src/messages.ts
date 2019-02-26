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

export function expectWarning(pattern: RegExp, fn: () => void) {
  if (expectStack.length === 0) {
    warn = expectedWarn;
  }
  expectStack.push(pattern);
  try {
    fn();
  } finally {
    expectStack.pop();
    if (expectStack.length === 0) {
      warn = realWarn;
    }
  }
  return handled.has(pattern);
}

let warn = realWarn;

export { todo, unsupported, warn, debug };
