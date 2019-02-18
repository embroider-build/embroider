declare module 'fast-sourcemap-concat' {
  // this is not exhaustive, just what we're using
  export default class {
    constructor(opts: { outputFile: string });
    addFile(filename: string): void;
    end(): Promise<void>;
  }
}
