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
    private buildHook: (trees: OutputPaths<NamedTrees>) => Promise<void>,
  ){
    super(flatTrees(trees), {
      persistentOutput: true,
      needsCache: false
    });
  }

  async build() {
    let result: { [treeName: string]: string | string[] } = {};
    let inputPathCounter = 0;
    for (let entry of findTrees(this.trees)) {
      if (entry.single) {
        result[entry.name] = this.inputPaths[inputPathCounter++];
      } else if (entry.multi) {
        result[entry.name] = this.inputPaths.slice(inputPathCounter, inputPathCounter += entry.multi.length);
      }
    }
    return this.buildHook(result as unknown as OutputPaths<NamedTrees>);
  }
}

export type OutputPaths<NamedTrees> = {
  [P in keyof NamedTrees]: NamedTrees[P] extends Tree ? string :
                           NamedTrees[P] extends Tree[] ? string[]
                           : never;
};

function isTree(x: any): x is Tree {
  return x && typeof x.__broccoliGetInfo__ === 'function';
}

function * findTrees<NamedTrees>(trees: NamedTrees): IterableIterator<{ name: string, single?: Tree, multi?: Tree[] }> {
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
