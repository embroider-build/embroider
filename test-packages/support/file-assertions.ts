import { pathExistsSync, readFileSync } from 'fs-extra';
import { resolve } from 'path';
import get from 'lodash/get';
import { Memoize } from 'typescript-memoize';

type ContentsResult = { result: true; data: string } | { result: false; actual: any; expected: any; message: string };
type JSONResult = { result: true; data: any } | { result: false; actual: any; expected: any; message: string };

export class BoundExpectFile {
  protected consumed = false;

  constructor(readonly basePath: string, readonly path: string, readonly adapter: AssertionAdapter) {
    (async () => {
      // we wait two microtasks because callers may legitimately need to wait
      // one microtask before consuming a TransformedExpectFile. They need to
      // consume it there.
      await Promise.resolve();
      await Promise.resolve();
      if (!this.consumed) {
        this.adapter.fail(
          `expectFile() was not consumed by another operation. You need to chain another call onto expectFile(), by itself it doesn't assert anything`
        );
      }
    })();
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
    this.adapter.assert({
      result: pathExistsSync(this.fullPath),
      actual: 'file missing',
      expected: 'file present',
      message: message || `${this.path} should exist`,
    });
  }

  doesNotExist(message?: string) {
    this.consumed = true;
    this.adapter.assert({
      result: !pathExistsSync(this.fullPath),
      actual: 'file present',
      expected: 'file missing',
      message: message || `${this.path} should not exist`,
    });
  }

  private doMatch(pattern: string | RegExp, message: string | undefined, invert: boolean) {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
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
      this.adapter.assert({
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
  equalsCode(expectedSource: string): void {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
    } else {
      this.adapter.codeEqual(this.contents.data, expectedSource);
    }
  }
  json(propertyPath?: string): JSONExpect {
    return new JSONExpect(
      this.adapter,
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
  async transform(fn: (contents: string, file: BoundExpectFile) => Promise<string>) {
    this.consumed = true;

    let transformed: ContentsResult;

    let raw = this.contents;
    if (!raw.result) {
      transformed = raw;
    } else {
      try {
        transformed = { result: true, data: await fn(raw.data, this) };
      } catch (err) {
        transformed = {
          result: false,
          actual: err,
          expected: 'transformer to run',
          message: err.stack,
        };
      }
    }

    return new TransformedFileExpect(this.basePath, this.path, this.adapter, transformed);
  }
}

export class TransformedFileExpect extends BoundExpectFile {
  constructor(basePath: string, path: string, adapter: AssertionAdapter, private transformed: ContentsResult) {
    super(basePath, path, adapter);
  }

  @Memoize()
  protected get contents(): ContentsResult {
    this.consumed = true;
    return this.transformed;
  }
  failsToTransform(message: string) {
    if (this.contents.result) {
      this.adapter.assert({
        result: false,
        actual: this.contents.data,
        expected: `a transform error`,
        message: `expected to catch a transform error but none was thrown`,
      });
    } else {
      this.adapter.assert({
        result: this.contents.actual.message.includes(message),
        actual: this.contents.actual.message,
        expected: message,
        message: `contents of transform exception`,
      });
    }
  }
}

export class JSONExpect {
  constructor(
    private adapter: AssertionAdapter,
    private path: string,
    private readUpstream: () => JSONResult,
    private propertyPath?: string | string[]
  ) {}

  get(propertyPath: string | string[]) {
    return new JSONExpect(this.adapter, this.path, () => this.contents, propertyPath);
  }

  deepEquals(expected: any): void {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
      return;
    }
    this.adapter.deepEquals(this.contents.data, expected);
  }

  equals(expected: any): void {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
      return;
    }
    this.adapter.equals(this.contents.data, expected);
  }

  includes(expected: any, message?: string): void {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
      return;
    }
    this.adapter.assert({
      result: Array.isArray(this.contents.data) && this.contents.data.includes(expected),
      actual: this.contents.data,
      expected,
      message: message || `expected value missing from array`,
    });
  }

  doesNotInclude(notExpected: any, message?: string): void {
    if (!this.contents.result) {
      this.adapter.assert(this.contents);
      return;
    }
    this.adapter.assert({
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

if (typeof expect !== 'undefined') {
  expect.extend({
    _fileAssertionsMatcher: fileAssertionsMatcher,
  });
}

declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      _fileAssertionsMatcher(state: { result: boolean; actual: any; expected: any; message: string }): void;
    }
  }
}

export interface AssertionAdapter {
  assert(state: { result: boolean; actual: any; expected: any; message: string }): void;

  fail(message: string): void;

  deepEquals(a: any, b: any): void;
  equals(a: any, b: any): void;
  codeEqual(actualCode: string, expectedCode: string): void;
}

export interface ExpectFile {
  (relativePath: string): BoundExpectFile;
  readonly basePath: string;
}
