declare module 'fast-sourcemap-concat' {
  // this is not exhaustive, just what we're using
  export default class {
    constructor(opts: { outputFile?: string; mapCommentType?: 'line' | 'block'; baseDir?: string });
    addFile(filename: string): void;
    addSpace(source: string): void;
    end(): Promise<void>;
  }
}
