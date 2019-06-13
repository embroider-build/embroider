import 'qunit';
import { pathExistsSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import get from 'lodash/get';
import { Memoize } from 'typescript-memoize';

export interface FileAssert extends Assert {
  basePath: string;
  file(path: string): BoundFileAssert;
}

type ContentsResult = { result: true; data: string } | { result: false; actual: any; expected: any; message: string };
type JSONResult = { result: true; data: any } | { result: false; actual: any; expected: any; message: string };

export class BoundFileAssert {
  constructor(readonly path: string, private assert: FileAssert) {}

  get basePath() {
    return this.assert.basePath;
  }

  @Memoize()
  get fullPath() {
    let path = this.path;
    if (this.assert.basePath) {
      path = join(this.assert.basePath, path);
    }
    return path;
  }

  @Memoize()
  protected get contents(): ContentsResult {
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
    this.assert.pushResult({
      result: pathExistsSync(this.fullPath),
      actual: 'file missing',
      expected: 'file present',
      message: message || `${this.path} should exist`,
    });
  }

  private doMatch(pattern: string | RegExp, message: string | undefined, invert: boolean) {
    if (!this.contents.result) {
      this.assert.pushResult(this.contents);
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
      this.assert.pushResult({
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
  json(propertyPath?: string): JSONAssert {
    return new JSONAssert(
      this.assert,
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
  transform(fn: (contents: string, file: BoundFileAssert) => string) {
    return new TransformedFileAssert(this.path, this.assert, fn);
  }
}

export class TransformedFileAssert extends BoundFileAssert {
  constructor(
    path: string,
    assert: FileAssert,
    private transformer: (contents: string, file: BoundFileAssert) => string
  ) {
    super(path, assert);
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

export class JSONAssert {
  constructor(
    private assert: Assert,
    private path: string,
    private readUpstream: () => JSONResult,
    private propertyPath?: string
  ) {}

  get(propertyPath: string) {
    return new JSONAssert(this.assert, this.path, () => this.contents, propertyPath);
  }

  deepEquals(expected: any, message?: string): void {
    if (!this.contents.result) {
      this.assert.pushResult(this.contents);
      return;
    }
    this.assert.deepEqual(this.contents.data, expected, message);
  }

  equals(expected: any, message?: string): void {
    if (!this.contents.result) {
      this.assert.pushResult(this.contents);
      return;
    }
    return this.assert.equal(this.contents.data, expected, message);
  }

  includes(expected: any, message?: string): void {
    if (!this.contents.result) {
      this.assert.pushResult(this.contents);
      return;
    }
    this.assert.pushResult({
      result: Array.isArray(this.contents.data) && this.contents.data.includes(expected),
      actual: this.contents.data,
      expected,
      message: message || `expected value missing from array`,
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

export interface FileHooks {
  before(fn: (assert: FileAssert) => void | Promise<void>): void;
  beforeEach(fn: (assert: FileAssert) => void | Promise<void>): void;
  afterEach(fn: (assert: FileAssert) => void | Promise<void>): void;
  after(fn: (assert: FileAssert) => void | Promise<void>): void;
}

function fileTest(name: string, definition: (assert: FileAssert) => void | Promise<void>) {
  QUnit.test(name, function(plainAssert: Assert) {
    return definition(plainAssert as FileAssert);
  });
}

function fileOnly(name: string, definition: (assert: FileAssert) => void | Promise<void>) {
  QUnit.only(name, function(plainAssert: Assert) {
    return definition(plainAssert as FileAssert);
  });
}

interface FileTest {
  (name: string, definition: (assert: FileAssert) => void | Promise<void>): void;
  skip(name: string, definition: (assert: FileAssert) => void | Promise<void>): void;
}

fileTest.skip = fileSkip;

function fileSkip(name: string, definition: (assert: FileAssert) => void | Promise<void>) {
  QUnit.skip(name, function(plainAssert: Assert) {
    return definition(plainAssert as FileAssert);
  });
}

function makeBoundFile(this: FileAssert, path: string) {
  return new BoundFileAssert(path, this);
}

export function installFileAssertions(hooks: NestedHooks) {
  let basePath: { current: string | undefined } = {
    current: undefined,
  };

  function installAssertions(plainAssert: Assert) {
    let assert = plainAssert as FileAssert;
    if (!assert.hasOwnProperty('basePath')) {
      Object.defineProperty(assert, 'basePath', {
        get() {
          return basePath.current;
        },
        set(value) {
          basePath.current = value;
        },
      });
    }
    assert.file = makeBoundFile;
  }

  // we need "before" if we want to be available in the user's "before" hook.
  // But we also need "beforeEach" because there's a new assert instance for
  // each test.
  hooks.before(installAssertions);
  hooks.beforeEach(installAssertions);

  return { test: fileTest as FileTest, only: fileOnly, skip: fileSkip, hooks: hooks as FileHooks };
}
