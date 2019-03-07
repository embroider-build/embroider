import 'qunit';
import { pathExistsSync, readFileSync, readJSONSync } from 'fs-extra';
import { join } from 'path';
import get from 'lodash/get';

const { test } = QUnit;

export interface FileAssert extends Assert {
  setBasePath(path: string): void;
  fileExists(path: string, message?: string): void;
  fileMatches(path: string, pattern: string | RegExp, message?: string): void;
  fileJSON(path: string, expected: any, propertyPath?: string, message?: string): void;
}

export interface FileHooks {
  before(fn: (assert: FileAssert) => void | Promise<void>): void;
  beforeEach(fn: (assert: FileAssert) => void | Promise<void>): void;
  afterEach(fn: (assert: FileAssert) => void | Promise<void>): void;
  after(fn: (assert: FileAssert) => void | Promise<void>): void;
}

function fileTest(name: string, definition: (assert: FileAssert) => void | Promise<void>) {
  test(name, function(plainAssert: Assert) {
    return definition(plainAssert as  FileAssert);
  });
}

export function installFileAssertions(hooks: NestedHooks) {
  let basePath: string | undefined;

  function setBasePath(this: FileAssert, path: string) {
    basePath = path;
  }

  function fileJSON(this: FileAssert, path: string, expected: any, propertyPath?: string, message?: string): void {
    if (basePath) {
      path = join(basePath, path);
    }
    let content;
    try {
      content = readJSONSync(path);
    } catch (err) {
      this.pushResult({
        result: false,
        actual: err,
        expected: 'valid json',
        message: message || `${path} fileJSON`
      });
      return;
    }
    if (propertyPath) {
      content = get(content, propertyPath);
    }
    this.deepEqual(content, expected, message);
  }

  function fileExists(this: FileAssert, path: string, message?: string) {
    if (basePath) {
      path = join(basePath, path);
    }
    this.pushResult({
      result: pathExistsSync(path),
      actual: 'file missing',
      expected: 'file present',
      message: message || `${path} should exist`
    });
  }

  function fileMatches(this: FileAssert, path: string, pattern: string | RegExp, message?: string) {
    let shortPath = path;
    if (basePath) {
      path = join(basePath, path);
    }
    if (!pathExistsSync(path)) {
      this.pushResult({
        result: false,
        actual: 'missing',
        expected: 'present',
        message: `${shortPath} should exist`
      });
    } else {
      let contents = readFileSync(path, 'utf8');
      let result;
      if (typeof pattern === 'string') {
        result = contents.indexOf(pattern) !== -1;
      } else {
        result = pattern.test(contents);
      }
      this.pushResult({
        result,
        actual: contents,
        expected: pattern,
        message: message || `${shortPath} contents unexpected`
      });
    }
  }

  function installAssertions(plainAssert: Assert) {
    let assert = plainAssert as FileAssert;
    assert.setBasePath = setBasePath;
    assert.fileExists = fileExists;
    assert.fileMatches = fileMatches;
    assert.fileJSON = fileJSON;
  }

  // we need "before" if we want to be available in the user's "before" hook.
  // But we also need "beforeEach" because there's a new assert instance for
  // each test.
  hooks.before(installAssertions);
  hooks.beforeEach(installAssertions);

  return { test: fileTest, hooks: hooks as FileHooks };
}
