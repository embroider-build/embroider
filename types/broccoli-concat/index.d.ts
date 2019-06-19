declare module 'broccoli-concat' {
  import Plugin, { Tree } from 'broccoli-plugin';

  export interface Options {
    outputFile: string;
    header?: string;
    headerFiles?: string[];
    inputFiles?: string[];
    footerFiles?: string[];
    footer?: string;
    sourceMapConfig?: { enabled?: boolean };
    allowNone?: boolean;
    annotation?: string;
    separator?: '\n;';
  }

  export default class Concat extends Plugin {
    constructor(inputTree: Tree, options: Options);
    build(): Promise<void>;
    protected srcDir: string;
  }
}
