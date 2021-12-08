import { pathExistsSync, readFileSync } from 'fs-extra';
import { resolve } from 'path';
import get from 'lodash/get';
import { Memoize } from 'typescript-memoize';

type ContentsResult = { result: true; data: string } | { result: false; actual: any; expected: any; message: string };
type JSONResult = { result: true; data: any } | { result: false; actual: any; expected: any; message: string };

export class BoundExpectFile {
  private consumed = false;

  constructor(readonly basePath: string, readonly path: string, readonly stack: Error) {
    Promise.resolve().then(() => {
      if (!this.consumed) {
        this.stack.message =
          "expectFile() was not consumed by another operation. You need to chain another call onto expectFile(), by itself it doesn't assert anything";
        throw this.stack;
      }
    });
  }

  @Memoize()
  get fullPath() {
    let path = this.path;
    if (this.basePath) {
      path = resolve(this.basePath, path);
    }
    return path;
  }

  @Memoize()
  protected get contents(): ContentsResult {
    this.consumed = true;
    try {
      return {
        result: true,
        data: readFileSync(this.fullPath, 'utf8'),
      };
    } catch (err) {
      return {
        result: false,
        actual: 'file missing',
        expected: 'file present',
        message: `${this.path} should exist`,
      };
    }
  }

  exists(message?: string) {
    this.consumed = true;
    assert(this.stack, this.path, {
      result: pathExistsSync(this.fullPath),
      actual: 'file missing',
      expected: 'file present',
      message: message || `${this.path} should exist`,
    });
  }

  doesNotExist(message?: string) {
    this.consumed = true;
    assert(this.stack, this.path, {
      result: !pathExistsSync(this.fullPath),
      actual: 'file present',
      expected: 'file missing',
      message: message || `${this.path} should not exist`,
    });
  }

  private doMatch(pattern: string | RegExp, message: string | undefined, invert: boolean) {
    if (!this.contents.result) {
      assert(this.stack, this.path, this.contents);
    } else {
      let result;
      if (typeof pattern === 'string') {
        result = this.contents.data.indexOf(pattern) !== -1;
      } else {
        result = pattern.test(this.contents.data);
      }
      if (invert) {
        result = !result;
      }
      assert(this.stack, this.path, {
        result,
        actual: this.contents.data,
        expected: pattern.toString(),
        message: message || `${this.path} contents unexpected`,
      });
    }
  }

  matches(pattern: string | RegExp, message?: string): void {
    this.doMatch(pattern, message, false);
  }
  doesNotMatch(pattern: string | RegExp, message?: string): void {
    this.doMatch(pattern, message, true);
  }
  json(propertyPath?: string): JSONExpect {
    return new JSONExpect(
      this.stack,
      this.path,
      () => {
        if (!this.contents.result) {
          return this.contents;
        }
        let parsed;
        try {
          parsed = JSON.parse(this.contents.data);
        } catch (err) {
          return {
            result: false,
            actual: this.contents.data,
            expected: 'valid json file',
            message: `${this.path} had invalid json`,
          };
        }
        return {
          result: true,
          data: parsed,
        };
      },
      propertyPath
    );
  }
  transform(fn: (contents: string, file: BoundExpectFile) => string) {
    this.consumed = true;
    return new TransformedFileExpect(this.basePath, this.path, this.stack, fn);
  }
}

export class TransformedFileExpect extends BoundExpectFile {
  constructor(
    basePath: string,
    path: string,
    stack: Error,
    private transformer: (contents: string, file: BoundExpectFile) => string
  ) {
    super(basePath, path, stack);
  }
  @Memoize()
  protected get contents(): ContentsResult {
    let raw = super.contents;
    if (!raw.result) {
      return raw;
    }
    try {
      return {
        result: true,
        data: this.transformer(raw.data, this),
      };
    } catch (err) {
      return {
        result: false,
        actual: err,
        expected: 'transformer to run',
        message: err.message,
      };
    }
  }
}

export class JSONExpect {
  constructor(
    private stack: Error,
    private path: string,
    private readUpstream: () => JSONResult,
    private propertyPath?: string | string[]
  ) {}

  get(propertyPath: string | string[]) {
    return new JSONExpect(this.stack, this.path, () => this.contents, propertyPath);
  }

  deepEquals(expected: any): void {
    if (!this.contents.result) {
      assert(this.stack, this.path, this.contents);
      return;
    }
    expect(this.contents.data).toEqual(expected);
  }

  equals(expected: any): void {
    if (!this.contents.result) {
      assert(this.stack, this.path, this.contents);
      return;
    }
    expect(this.contents.data).toBe(expected);
  }

  includes(expected: any, message?: string): void {
    if (!this.contents.result) {
      assert(this.stack, this.path, this.contents);
      return;
    }
    assert(this.stack, this.path, {
      result: Array.isArray(this.contents.data) && this.contents.data.includes(expected),
      actual: this.contents.data,
      expected,
      message: message || `expected value missing from array`,
    });
  }

  doesNotInclude(notExpected: any, message?: string): void {
    if (!this.contents.result) {
      assert(this.stack, this.path, this.contents);
      return;
    }
    assert(this.stack, this.path, {
      result: Array.isArray(this.contents.data) && !this.contents.data.includes(notExpected),
      actual: this.contents.data,
      expected: `not ${notExpected}`,
      message: message || `expected array to not include ${notExpected}`,
    });
  }

  @Memoize()
  private get contents(): JSONResult {
    let upstream = this.readUpstream();
    if (!upstream.result) {
      return upstream;
    }
    let value = upstream.data;
    if (this.propertyPath) {
      value = get(value, this.propertyPath);
    }
    return {
      result: true,
      data: value,
    };
  }
}

function fileAssertionsMatcher(
  this: jest.MatcherUtils,
  path: string,
  state: {
    result: boolean;
    actual: any;
    expected: any;
    message: string;
  }
) {
  let pass = this.isNot ? !state.result : state.result;
  let message = () =>
    `${path}\n` +
    `Expected: ${this.utils.printExpected(state.expected)}\n` +
    `Received: ${this.utils.printReceived(state.actual)}`;
  return { actual: state.actual, pass, message };
}

expect.extend({
  _fileAssertionsMatcher: fileAssertionsMatcher,
});

declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      _fileAssertionsMatcher(state: { result: boolean; actual: any; expected: any; message: string }): void;
    }
  }
}

function assert(
  err: Error,
  path: string,
  state: {
    result: boolean;
    actual: any;
    expected: any;
    message: string;
  }
): void {
  try {
    expect(path)._fileAssertionsMatcher(state);
  } catch (upstreamErr) {
    (err as any).matcherResult = upstreamErr.matcherResult;
    err.message = upstreamErr.message;
    throw err;
  }
}

export function expectFilesAt(basePath: string): ExpectFile {
  let func = (relativePath: string) => {
    return expectFile(func, basePath, relativePath);
  };
  return func;
}

export type ExpectFile = (relativePath: string) => BoundExpectFile;

function expectFile(callsite: any, basePath: string, relativePath: string): BoundExpectFile {
  let err = new Error();
  Error.captureStackTrace(err, callsite);
  return new BoundExpectFile(basePath, relativePath, err);
}
