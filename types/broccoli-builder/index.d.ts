declare module 'broccoli-builder' {

  export interface Summary {
    directory: string;
  }

  export class Builder {
    constructor(tree: unknown)
    build(): Promise<Summary>;
    cleanup(): Promise<void>;
  }

}
