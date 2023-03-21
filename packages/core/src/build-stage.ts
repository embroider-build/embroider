import WaitForTrees, { OutputPaths } from './wait-for-trees';
import type { Node } from 'broccoli-node-api';
import { Memoize } from 'typescript-memoize';

// This is a utility class for defining new build stages. It aids in handling
// the boilerplate required to split your functionality between the
// broccoli-pipeline-construction phase and the actual building phase.
export default class BuildStage<NamedTrees> {
  private active: BuilderInstance<NamedTrees> | undefined;

  constructor(
    private prevStage: Node,
    private inTrees: NamedTrees,
    private annotation: string,
    private instantiate: () => Promise<BuilderInstance<NamedTrees>>
  ) {}

  @Memoize()
  get tree(): Node {
    return new WaitForTrees(this.augment(this.inTrees), this.annotation, async treePaths => {
      if (!this.active) {
        this.active = await this.instantiate();
      }
      delete (treePaths as any).__prevStageTree;
      await this.active.build(this.deAugment(treePaths));
    });
  }

  private augment(inTrees: NamedTrees): NamedTrees & ExtraTree {
    return Object.assign({ __prevStageTree: this.prevStage }, inTrees);
  }

  private deAugment(treePaths: OutputPaths<NamedTrees & ExtraTree>): OutputPaths<NamedTrees> {
    delete (treePaths as any).__prevStageTree;
    return treePaths;
  }
}

interface BuilderInstance<NamedTrees> {
  build(inputPaths: OutputPaths<NamedTrees>): Promise<void>;
}

interface ExtraTree {
  __prevStageTree: Node;
}
