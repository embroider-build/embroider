import { install } from 'code-equality-assertions/qunit';
import { AssertionAdapter, BoundExpectFile, ExpectFile } from '../file-assertions';
import { explicitRelative, RewrittenPackageCache } from '../../../packages/shared-internals';
import { resolve } from 'path';

class QUnitAdapter implements AssertionAdapter {
  constructor(private qassert: Assert) {
    install(qassert);
  }

  assert(state: { result: boolean; actual: any; expected: any; message: string }): void {
    this.qassert.pushResult(state);
  }

  fail(message: string) {
    this.qassert.ok(false, message);
  }

  deepEquals(a: any, b: any) {
    this.qassert.deepEqual(a, b);
  }

  equals(a: any, b: any) {
    this.qassert.equal(a, b);
  }

  codeEqual(a: string, b: string) {
    this.qassert.codeEqual(a, b);
  }
}

export function expectFilesAt(basePath: string, params: { qunit: Assert }): ExpectFile {
  let func: any = (relativePath: string) => {
    return new BoundExpectFile(basePath, relativePath, new QUnitAdapter(params.qunit));
  };
  Object.defineProperty(func, 'basePath', {
    get() {
      return basePath;
    },
  });
  return func;
}

function getRewrittenLocation(appDir: string, inputPath: string) {
  let packageCache = RewrittenPackageCache.shared('embroider', appDir);
  let fullInputPath = resolve(appDir, inputPath);
  let owner = packageCache.ownerOfFile(fullInputPath);
  if (!owner) {
    return inputPath;
  }
  let movedOwner = packageCache.maybeMoved(owner);
  if (movedOwner === owner) {
    return inputPath;
  }
  let movedFullPath = fullInputPath.replace(owner.root, movedOwner.root);
  return explicitRelative(appDir, movedFullPath);
}

export function expectRewrittenFilesAt(
  basePath: string,
  params: { qunit: Assert }
): ExpectFile & { toRewrittenPath: (s: string) => string } {
  let func: any = (inputPath: string) => {
    return new BoundExpectFile(basePath, getRewrittenLocation(basePath, inputPath), new QUnitAdapter(params.qunit));
  };
  Object.defineProperty(func, 'basePath', {
    get() {
      return basePath;
    },
  });
  Object.defineProperty(func, 'toRewrittenPath', {
    get() {
      return (p: string) => getRewrittenLocation(basePath, p);
    },
  });
  return func;
}

export { ExpectFile };
