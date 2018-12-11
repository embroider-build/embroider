declare module 'fs-tree-diff' {

  export default class FSTree {
    static fromEntries(input: Entry[]): FSTree;
    calculatePatch(next: FSTree, isEqual?: (a: Entry, b: Entry) => boolean): Operation[]
    static defaultIsEqual(a: Entry, b: Entry): boolean;
  }

  export type Operation = [
    'unlink' | 'rmdir' | 'mkdir' | 'change' | 'create',
    string,
    Entry
  ];

  export interface Entry {
    relativePath: string;
    mode: number;
    size: number;
    mtime: number;
    isDirectory(): boolean;
  }
}
