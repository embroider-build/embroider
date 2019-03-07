import 'qunit';
import { pathExistsSync } from 'fs-extra';
import { join } from 'path';

const { test } = QUnit;

export interface FileAssert extends Assert {
  setBasePath(path: string): void;
  fileExists(path: string): void;
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

  function setBasePath(path: string) {
    basePath = path;
  }

  function fileExists(this: FileAssert, path: string) {
    if (basePath) {
      path = join(basePath, path);
    }
    this.pushResult({
      result: pathExistsSync(path),
      actual: 'file missing',
      expected: 'file present',
      message: `${path} should exist`
    });
  }

  function installAssertions(plainAssert: Assert) {
    let assert = plainAssert as FileAssert;
    assert.setBasePath = setBasePath;
    assert.fileExists = fileExists;
  }

  // we need "before" if we want to be available in the user's "before" hook.
  // But we also need "beforeEach" because there's a new assert instance for
  // each test.
  hooks.before(installAssertions);
  hooks.beforeEach(installAssertions);

  return { test: fileTest, hooks: hooks as FileHooks };
}
