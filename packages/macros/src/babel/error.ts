import type { NodePath } from '@babel/traverse';

export default function error(path: NodePath, message: string) {
  // this typecast is to workaround an issue in @types/babel__traverse https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/67183
  return path.buildCodeFrameError(message, MacroError as unknown as ErrorConstructor);
}

class MacroError extends Error {
  type = '@embroider/macros Error';
  constructor(message: string) {
    super(message);
    this.name = 'MacroError';
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else if (!this.stack) {
      this.stack = new Error(message).stack;
    }
  }
}
