import makeDebug from 'debug';
import { format } from 'util';

const todo = makeDebug('embroider:todo');
const unsupported = makeDebug('embroider:unsupported');
const debug = makeDebug('embroider:debug');

// this is here to make TS happy :( qunit only defines global types and this is the only way to
// explicitly import them in this file. It would have been better if we could import NestedHooks
// from qunit
import 'qunit';

function realWarn(message: string, params: any[]) {
  if (hardFailMode > 0) {
    throw new Error(`Unexpected warning in test suite: ${format(message, ...params)}`);
  } else {
    console.log('WARNING: ' + format(message, ...params));
  }
}

let expectStack = [] as RegExp[];
let handled: WeakSet<RegExp> = new WeakSet();

function expectedWarn(message: string, params: any[]) {
  let formattedMessage = format(message, ...params);
  for (let pattern of expectStack) {
    if (pattern.test(formattedMessage)) {
      handled.add(pattern);
      return;
    }
  }
  realWarn(message, params);
}

export function warn(message: string, ...params: any[]) {
  if (expectStack.length === 0) {
    realWarn(message, params);
  } else {
    expectedWarn(message, params);
  }
}

// for use in our test suites
let hardFailMode = 0;
export function throwOnWarnings(hooks?: NestedHooks) {
  if (hooks) {
    // qunit mode
    hooks.before(() => {
      hardFailMode++;
    });
    hooks.after(() => {
      hardFailMode--;
    });
  } else {
    // Jest mode
    beforeAll(() => hardFailMode++);
    afterAll(() => hardFailMode--);
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
