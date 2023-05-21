import WaitForTrees, { OutputPaths } from './wait-for-trees';
import Stage from './stage';
import { Node } from 'broccoli-node-api';
import { Memoize } from 'typescript-memoize';

// This is a utility class for defining new Stages. It aids in handling the
// boilerplate required to split your functionality between the
// broccoli-pipeline-construction phase and the actual building phase.
export default class BuildStage<NamedTrees> implements Stage {
  private active: BuilderInstance<NamedTrees> | undefined;
  private outputPath: string | undefined;

  constructor(
    private prevStage: Stage,
    private inTrees: NamedTrees,
    private annotation: string,
    private instantiate: (root: string, appSrcDir: string) => Promise<BuilderInstance<NamedTrees>>
  ) {}

  @Memoize()
  get tree(): Node {
    return new WaitForTrees(this.augment(this.inTrees), this.annotation, async treePaths => {
      if (!this.active) {
        let { outputPath } = await this.prevStage.ready();
        this.outputPath = outputPath;
        this.active = await this.instantiate(outputPath, this.prevStage.inputPath);
      }
      delete (treePaths as any).__prevStageTree;
      await this.active.build(this.deAugment(treePaths));
      this.deferReady.resolve();
    });
  }

  get inputPath(): string {
    return this.prevStage.inputPath;
  }

  async ready(): Promise<{ outputPath: string }> {
    await this.deferReady.promise;
    return {
      outputPath: this.outputPath!,
    };
  }

  @Memoize()
  private get deferReady() {
    let resolve: Function;
    let promise: Promise<void> = new Promise(r => (resolve = r));
    return { resolve: resolve!, promise };
  }

  private augment(inTrees: NamedTrees): NamedTrees & ExtraTree {
    return Object.assign({ __prevStageTree: this.prevStage.tree }, inTrees);
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
