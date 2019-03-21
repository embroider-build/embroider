declare module 'broccoli-persistent-filter' {
  import Plugin, { Tree } from 'broccoli-plugin';

  interface Options {
    persist: boolean;
    name?: string;
    extensions: string[];
    targetExtension?: string;
  }

  export default abstract class Filter implements Plugin {
    constructor(inputTree: Tree, options: Options);
    inputPaths: string[];
    outputPath: string;
    cachePath: string;
    __broccoliGetInfo__(): any;
    build(): Promise<void> | void;
    cacheKeyProcessString(contents: string, relativePath: string): string;
    abstract processString(contents: string, relativePath: string): string;
  }
}
