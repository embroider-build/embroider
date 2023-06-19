import { Node } from 'broccoli-node-api';
import WaitForTrees from './wait-for-trees';
import TreeSync from 'tree-sync';

export function outputTree(tree: Node, annotation: string, destination: string): Node {
  let treeSync: TreeSync | undefined;
  return new WaitForTrees({ tree }, annotation, async ({ tree: inputPath }, changed) => {
    let firstBuild = true;

    if (treeSync) {
      firstBuild = false;
    } else {
      treeSync = new TreeSync(inputPath, destination);
    }

    if (firstBuild || changed.get(inputPath)) {
      treeSync.sync();
    }
  });
}
