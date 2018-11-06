declare module 'broccoli-plugin' {

  export interface Tree {}

  export interface Options {
    name?: string;
    annotation?: string;
    persistentOutput?: boolean;
    needsCache?: boolean;
  }


  export default abstract class Plugin {
    constructor(inputTrees: Tree[], options: Options)
    inputPaths: string[];
    outputPath: string;
    abstract build(): Promise<void> | void;
  }

}
