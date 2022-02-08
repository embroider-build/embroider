declare module 'broccoli' {
  import type { SourceNodeInfo } from 'broccoli-node-api';

  export class Builder {
    constructor(tree: unknown);
    build(): Promise<void>;
    cleanup(): Promise<void>;
    outputPath: string;
    readonly watchedSourceNodeWrappers: {
      nodeInfo: SourceNodeInfo;
      revise(): void;
    }[];
  }
}
