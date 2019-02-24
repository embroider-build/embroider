
declare module 'ember-cli-htmlbars' {

  import Plugin, { Tree } from "broccoli-plugin";

  export interface Options {
    templateCompilerPath: string;
    name?: string;
  }

  export default class HTMLBarsTransform extends Plugin {
    constructor(inputTree: Tree, options: Options)
    build(): Promise<void>;
    protected cacheKeyProcessString(contents: string, relativePath: string): string;
    protected targetExtension: string | null;
  }


}
