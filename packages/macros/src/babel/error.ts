import type { NodePath } from '@babel/traverse';

export default function error(path: NodePath, message: string) {
  return path.buildCodeFrameError(message, MacroError);
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
