declare module 'broccoli' {

  export class Builder {
    constructor(tree: unknown)
    build(): Promise<void>;
    cleanup(): Promise<void>;
    outputPath: string;
  }

}
