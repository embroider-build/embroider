import WaitForTrees, { OutputPaths } from './wait-for-trees';
import { PackageCache } from '@embroider/shared-internals';
import Stage from './stage';
import { Node } from 'broccoli-node-api';
import { Memoize } from 'typescript-memoize';

// This is a utility class for defining new Stages. It aids in handling the
// boilerplate required to split your functionality between the
// broccoli-pipeline-construction phase and the actual building phase.
export default class BuildStage<NamedTrees> implements Stage {
  private active: BuilderInstance<NamedTrees> | undefined;
  private outputPath: string | undefined;
  private packageCache: PackageCache | undefined;

  constructor(
    private prevStage: Stage,
    private inTrees: NamedTrees,
    private annotation: string,
    private instantiate: (
      root: string,
      appSrcDir: string,
      packageCache: PackageCache
    ) => Promise<BuilderInstance<NamedTrees>>
  ) {}

  @Memoize()
  get tree(): Node {
    return new WaitForTrees(this.augment(this.inTrees), this.annotation, async treePaths => {
      if (!this.active) {
        let { outputPath, packageCache } = await this.prevStage.ready();
        if (!packageCache) {
          packageCache = new PackageCache();
        }
        this.outputPath = outputPath;
        this.packageCache = packageCache;
        this.active = await this.instantiate(outputPath, this.prevStage.inputPath, packageCache);
      }
      delete (treePaths as any).__prevStageTree;
      await this.active.build(this.deAugment(treePaths));
      this.deferReady.resolve();
    });
  }

  get inputPath(): string {
    return this.prevStage.inputPath;
  }

  async ready(): Promise<{ outputPath: string; packageCache: PackageCache }> {
    await this.deferReady.promise;
    return {
      outputPath: this.outputPath!,
      packageCache: this.packageCache!,
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
