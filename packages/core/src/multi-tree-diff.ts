import FSTree, { Operation, Entry } from 'fs-tree-diff';

interface InputTree {
  walk(): Entry[];
  mayChange: boolean;
}

// tells you which of your inTrees (by index) resulted in the given output file
export type Sources = Map<string, number>;

export default class MultiTreeDiff {
  private prevEntries: Entry[][] | undefined;
  private prevCombined: FSTree = new FSTree();
  private prevSources: Sources = new Map();
  private owners: WeakMap<Entry, number> = new WeakMap();

  constructor(
    private inTrees: InputTree[]
  ) {}

  update(): { ops: Operation[], sources: Sources } {
    let combinedEntries: Entry[] = [];
    let sources: Map<string, number> = new Map();

    let entries = this.inTrees.map((tree, index) => {
      if (!tree.mayChange && this.prevEntries && this.prevEntries[index]) {
        return this.prevEntries[index];
      }
      return tree.walk();
    });
    this.prevEntries = entries;

    for (let [treeIndex, treeEntries] of entries.entries()) {
      for (let entry of treeEntries) {
        sources.set(entry.relativePath, treeIndex);
        this.owners.set(entry, treeIndex);
      }
      combinedEntries = combinedEntries.concat(treeEntries);
      treeIndex++;
    }

    // FSTree requires the entries to be sorted and uniq. We achieve uniqueness
    // by only keeping the winner for each relativePath.
    combinedEntries = combinedEntries.filter(entry => this.owners.get(entry) === sources.get(entry.relativePath));
    combinedEntries.sort(compareByRelativePath);

    let newFSTree = FSTree.fromEntries(combinedEntries);
    let ops = this.prevCombined.calculatePatch(newFSTree, isEqual(this.owners));
    this.prevCombined = newFSTree;
    this.prevSources = sources;
    return { ops, sources };
  }
}

function compareByRelativePath(entryA: Entry, entryB: Entry) {
  let pathA = entryA.relativePath;
  let pathB = entryB.relativePath;

  if (pathA < pathB) {
    return -1;
  } else if (pathA > pathB) {
    return 1;
  }
  return 0;
}

function isEqual(owners: WeakMap<Entry, number>) {
  return function(a: Entry, b: Entry) {
    return FSTree.defaultIsEqual(a,b) && owners.get(a) === owners.get(b);
  };
}
