import { install } from 'code-equality-assertions/qunit';
import { AssertionAdapter, BoundExpectFile, ExpectFile } from '../file-assertions';

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

export { ExpectFile };
