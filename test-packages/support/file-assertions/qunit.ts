import { install } from 'code-equality-assertions/qunit';
import { AssertionAdapter, BoundExpectFile, ExpectFile } from '../file-assertions';
import { packageName } from '../../../packages/shared-internals';
import crypto from 'crypto';

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

function getRewrittenLocation(appDir: string, addonPath: string) {
  let name = packageName(addonPath);
  if (!name) {
    throw new Error('getRewrittenLocation only accepts fully-qualified paths');
  }

  const syntheticPackages = ['@embroider/synthesized-styles', '@embroider/synthesized-vendor'];

  if (syntheticPackages.includes(name)) {
    return `node_modules/.embroider/rewritten-packages/${name}/${addonPath.slice(name.length)}`;
  }

  let h = crypto.createHash('sha1');
  let hash = h.update(`${appDir}/node_modules/${name}`).digest('hex').slice(0, 8);

  return `node_modules/.embroider/rewritten-packages/${name}.${hash}/${addonPath.slice(name.length)}`;
}

export function expectRewrittenAddonFilesAt(basePath: string, params: { qunit: Assert }): ExpectFile {
  let func: any = (addonPath: string) => {
    return new BoundExpectFile(basePath, getRewrittenLocation(basePath, addonPath), new QUnitAdapter(params.qunit));
  };
  Object.defineProperty(func, 'basePath', {
    get() {
      return basePath;
    },
  });
  return func;
}

export { ExpectFile };
