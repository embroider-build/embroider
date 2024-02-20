import 'code-equality-assertions/jest';
import type { AssertionAdapter } from '../file-assertions';
import { BoundExpectFile, ExpectFile } from '../file-assertions';

class JestAdapter implements AssertionAdapter {
  constructor(private stack: Error, private path: string) {}
  assert(state: { result: boolean; actual: any; expected: any; message: string }): void {
    try {
      expect(this.path)._fileAssertionsMatcher(state);
    } catch (upstreamErr) {
      (this.stack as any).matcherResult = upstreamErr.matcherResult;
      this.stack.message = upstreamErr.message;
      throw this.stack;
    }
  }
  fail(message: string) {
    this.stack.message = message;
    throw this.stack;
  }

  deepEquals(a: any, b: any) {
    expect(a).toEqual(b);
  }

  equals(a: any, b: any) {
    expect(a).toBe(b);
  }

  codeEqual(expectedCode: string, actualCode: string) {
    expect(expectedCode).toEqualCode(actualCode);
  }
}

export function expectFilesAt(basePath: string): ExpectFile {
  let func: any = (relativePath: string) => {
    return jestExpectFile(func, basePath, relativePath);
  };
  Object.defineProperty(func, 'basePath', {
    get() {
      return basePath;
    },
  });
  return func;
}

function jestExpectFile(callsite: any, basePath: string, relativePath: string): BoundExpectFile {
  let err = new Error();
  Error.captureStackTrace(err, callsite);
  return new BoundExpectFile(basePath, relativePath, new JestAdapter(err, relativePath));
}

export { ExpectFile };
