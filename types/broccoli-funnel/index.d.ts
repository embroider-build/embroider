declare module 'broccoli-funnel' {
  import { Tree } from 'broccoli-plugin';
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
  export default class Funnel {
    constructor(inputTree: Tree, options: Options);
    inputPaths: string[];
    srcDir: string;
    srcDirs: string[];
    build(): Promise<void>;
  }

}
