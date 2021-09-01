declare module 'ember-cli-htmlbars' {
  import Plugin from 'broccoli-plugin';
  import { Node } from 'broccoli-node-api';

  export interface Options {
    name?: string;
    plugins?: {
      ast?: never[];
      [type: string]: unknown[];
    };
    templateCompiler: unknown;
    templateCompilerPath: string;
  };


  export default class HTMLBarsTransform extends Plugin {
    constructor(inputTree: Node, options: Options);
    build(): Promise<void>;
    protected cacheKeyProcessString(contents: string, relativePath: string): string;
    protected targetExtension: string | null;
  }
}
