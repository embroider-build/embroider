import BroccoliPlugin, { Tree } from 'broccoli-plugin';

/*
  Takes some named broccoli trees and/or lists of broccoli trees and gives you
  the resulting inputPaths once those trees are built. Example:

    import { Tree } from 'broccoli-plugin';

    interface MyInputs<T> {
      codeFromMyApp: T,
      codeFromMyAddons: T[]
    }

    function(trees: MyInputs<Tree>): Tree {
      return WaitForTrees(trees, build);
    }

    async function build(paths: MyInputs<string>) {
      // paths.someTree is a string
      // paths.otherTrees is a string[]
    }

*/
export default class WaitForTrees<NamedTrees> extends BroccoliPlugin {
  constructor(
    private trees: NamedTrees,
    annotation: string,
    private buildHook: (trees: OutputPaths<NamedTrees>, changed: Map<string, boolean>) => Promise<void>
  ) {
    super(flatTrees(trees), {
      persistentOutput: true,
      needsCache: false,
      annotation: annotation,
      trackInputChanges: true,
    });
  }

  async build(detail: { changedNodes: boolean[] } | undefined) {
    let result: { [treeName: string]: string | string[] } = {};
    let changedMap = new Map();

    let inputPathCounter = 0;
    for (let entry of findTrees(this.trees)) {
      if (entry.single) {
        result[entry.name] = this.inputPaths[inputPathCounter];
        let didChange = detail ? detail.changedNodes[inputPathCounter] : true;
        changedMap.set(this.inputPaths[inputPathCounter], didChange);
        inputPathCounter += 1;
      } else if (entry.multi) {
        let sliced = this.inputPaths.slice(inputPathCounter, inputPathCounter + entry.multi.length);

        result[entry.name] = sliced.map(slice => {
          let didChange = detail ? detail.changedNodes[inputPathCounter] : true;
          changedMap.set(slice, didChange);
          inputPathCounter++;
          return slice;
        });
      }
    }
    return this.buildHook((result as unknown) as OutputPaths<NamedTrees>, changedMap);
  }
}

export type OutputPaths<NamedTrees> = {
  [P in keyof NamedTrees]: NamedTrees[P] extends Tree ? string : NamedTrees[P] extends Tree[] ? string[] : never
};

function isTree(x: any): x is Tree {
  return x && typeof x.__broccoliGetInfo__ === 'function';
}

function* findTrees<NamedTrees>(trees: NamedTrees): IterableIterator<{ name: string; single?: Tree; multi?: Tree[] }> {
  for (let [name, value] of Object.entries(trees)) {
    if (Array.isArray(value)) {
      yield { name, multi: value.filter(isTree) };
    } else {
      if (isTree(value)) {
        yield { name, single: value };
      }
    }
  }
}

function flatTrees<NamedTrees>(trees: NamedTrees) {
  let output: Tree[] = [];
  for (let value of findTrees(trees)) {
    if (value.multi) {
      output = output.concat(value.multi);
    } else if (value.single) {
      output.push(value.single);
    }
  }
  return output;
}
