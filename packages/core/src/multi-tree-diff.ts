import FSTree, { Operation, Entry } from 'fs-tree-diff';
import lodashIsEqual from 'lodash/isEqual';

export interface InputTree {
  walk(): Entry[];
  mayChange: boolean;
}

// tells you which of your inTrees (by index) resulted in the given output file
export class Sources {
  constructor(
    private combinedEntries: ReturnType<MultiTreeDiff['combinedEntries']>,
    private combinedOwners: MultiTreeDiff['combinedOwners']
  ) {}
  get(relativePath: string): number[] {
    return this.combinedOwners.get(this.combinedEntries.get(relativePath)!)!;
  }
}

// this is how you control what happens when multiple trees try to output the
// same path. Your merger function is told which trees are trying to collide,
// and you say which ones will be allowed to influence the output. More than one
// winner is allowed because sometimes you will be merging their contents.
export type Merger = (treeIndices: number[]) => number[];

export default class MultiTreeDiff {
  private prevEntries: Entry[][] | undefined;
  private prevCombined: FSTree = new FSTree();

  // tracks which input Entry is owned by which input tree
  private owners: WeakMap<Entry, number> = new WeakMap();

  // tracks which output Entry is owned by which set of input trees. This is
  // different from `owners` because merging is possible.
  private combinedOwners: WeakMap<Entry, number[]> = new WeakMap();

  constructor(private inTrees: InputTree[], private merger: Merger) {}

  private allEntries(): Entry[][] {
    let result = this.inTrees.map((tree, index) => {
      if (!tree.mayChange && this.prevEntries && this.prevEntries[index]) {
        return this.prevEntries[index];
      }
      return tree.walk();
    });
    this.prevEntries = result;
    return result;
  }

  private candidates(entries: Entry[][]): Map<string, Entry[]> {
    let result: Map<string, Entry[]> = new Map();
    for (let [treeIndex, treeEntries] of entries.entries()) {
      for (let entry of treeEntries) {
        let list = result.get(entry.relativePath);
        if (!list) {
          list = [];
          result.set(entry.relativePath, list);
        }
        list.push(entry);
        this.owners.set(entry, treeIndex);
      }
    }
    return result;
  }

  private combinedEntries(candidates: Map<string, Entry[]>): Map<string, Entry> {
    let result: Map<string, Entry> = new Map();
    for (let [relativePath, entries] of candidates.entries()) {
      if (entries.length === 1) {
        let [entry] = entries;
        // no collision, simple case.
        result.set(relativePath, entry);
        this.combinedOwners.set(entry, [this.owners.get(entry)!]);
      } else {
        // collision, apply merge logic
        let winners = this.merger(entries.map(e => this.owners.get(e)!));
        if (winners.length === 1) {
          // single winner, no merging
          let winner = entries.find(e => this.owners.get(e) === winners[0])!;
          result.set(relativePath, winner);
          this.combinedOwners.set(winner, winners);
        } else {
          // multiple winners, must synthesize a combined entry
          let winningEntries = entries.filter(e => winners.includes(this.owners.get(e)!));
          let combinedEntry: Entry = {
            relativePath,
            size: winningEntries.reduce((accum, entry) => {
              return accum + (entry.size || 0);
            }, 0),
            mtime: winningEntries.reduce((accum: undefined | number | Date, entry) => {
              return latest(accum, entry.mtime);
            }, undefined),
            isDirectory() {
              return false;
            },
          };
          result.set(relativePath, combinedEntry);
          this.combinedOwners.set(combinedEntry, winners);
        }
      }
    }
    return result;
  }

  update(): { ops: Operation[]; sources: Sources } {
    let combinedEntries = this.combinedEntries(this.candidates(this.allEntries()));

    // FSTree requires the entries to be sorted and uniq. We already have
    // uniqueness because we're taking them out of a map. And here we do the
    // sort.
    let combinedEntriesList = [...combinedEntries.values()].sort(compareByRelativePath);
    let newFSTree = FSTree.fromEntries(combinedEntriesList);
    let ops = this.prevCombined.calculatePatch(newFSTree, isEqual(this.combinedOwners));
    this.prevCombined = newFSTree;
    return { ops, sources: new Sources(combinedEntries, this.combinedOwners) };
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

function isEqual(owners: WeakMap<Entry, number[]>) {
  return function(a: Entry, b: Entry) {
    return FSTree.defaultIsEqual(a, b) && lodashIsEqual(owners.get(a), owners.get(b));
  };
}

function latest(a: number | Date | undefined, b: number | Date | undefined): number | undefined | Date {
  if (a == null) {
    return b;
  }
  if (b == null) {
    return a;
  }
  if (a instanceof Date) {
    a = a.getTime();
  }
  if (b instanceof Date) {
    b = b.getTime();
  }
  return Math.max(a, b);
}
