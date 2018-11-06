declare module 'broccoli-source' {
  import { Tree } from 'broccoli-plugin';

  export class WatchedDir implements Tree {
    constructor(inputDir: string);
  }

  export class UnwatchedDir implements Tree {
    constructor(inputDir: string);
  }

}
