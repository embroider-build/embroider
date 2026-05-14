import makeDebug from 'debug';
import { format } from 'util';

const todo = makeDebug('embroider:todo');
const unsupported = makeDebug('embroider:unsupported');
const debug = makeDebug('embroider:debug');

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

/**
 * This type is normally from QUnit as a global.
 * But dependents on `@embroider/core` may not be testing with QUnit,
 * so we can't rely on the global availability of the NestedHooks interface.
 *
 * Here, we define only what we use in a way that is compatible with QUnit's types.
 */
interface NestedHooks {
  before: (callback: () => void | Promise<void>) => void;
  after: (callback: () => void | Promise<void>) => void;
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
    /**
     * Like with QUnit's NestedHooks, we can't be certain that our
     * consuming environment will provide types for beforeAll and afterAll
     */
    (globalThis as any).beforeAll(() => hardFailMode++);
    (globalThis as any).afterAll(() => hardFailMode--);
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
