declare module 'babel-core' {

  export class Pipeline {}
  export class File {
    constructor(babelOptions: any, pipeline: Pipeline);
    parserOpts: any;
  }

}
