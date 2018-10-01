declare module 'broccoli-funnel' {

  export default class Funnel {
    constructor(inputTree, options: any);
    inputPaths: string[];
    srcDir: string;
    srcDirs: string[];
    build();
  }

}
