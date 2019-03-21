declare module 'broccoli-funnel' {
  import Plugin, { Tree } from 'broccoli-plugin';
  export interface Options {
    srcDir?: string;
    destDir?: string;
    allowEmpty?: boolean;
    include?: (string | RegExp | Function)[];
    exclude?: (string | Function)[];
    files?: string[];
    getDestinationPath?: (relativePath: string) => string;
    annotation?: string;
  }
  export default class Funnel extends Plugin {
    constructor(inputTree: Tree, options: Options);
    build(): Promise<void>;
    protected srcDir: string;
  }
}
