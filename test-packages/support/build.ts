import { Project } from './project';
import EmberCLIProject from 'ember-cli/lib/models/project';
import { Addons, App } from '@embroider/compat';
import { Builder } from 'broccoli';
import EmberApp from 'ember-cli/lib/broccoli/ember-app';
import EmberAddon from 'ember-cli/lib/broccoli/ember-addon';
import Instrumentation from 'ember-cli/lib/models/instrumentation';
import PackageInfoCache from 'ember-cli/lib/models/package-info-cache';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import MockUI from 'console-ui/mock';
import { TransformOptions, transform } from '@babel/core';
import { Options } from '../../packages/compat/src';
import { BoundExpectFile } from './file-assertions';
import { AppMeta, hbsToJS } from '@embroider/core';
import { Memoize } from 'typescript-memoize';
import { stableWorkspaceDir } from '@embroider/compat/src/default-pipeline';

export interface BuildParams {
  stage: 1 | 2;
  type: 'app' | 'addon';
  emberAppOptions: any;
  embroiderOptions: Options;
}

const defaultParams = Object.freeze({
  stage: 1,
  type: 'app',
  emberAppOptions: Object.freeze({}),
  embroiderOptions: Object.freeze({}),
});

export default class BuildResult {
  static async build(project: Project, rawParams: Partial<BuildParams>) {
    let params: BuildParams = Object.assign({}, defaultParams, rawParams);
    params.emberAppOptions = Object.assign({}, params.emberAppOptions);
    params.embroiderOptions = Object.assign({}, params.embroiderOptions);
    project.writeSync();

    let origDir = process.cwd();
    try {
      // this is here because EmberAddon makes a bad assumption that the project
      // root is always the current working directory
      process.chdir(project.baseDir);

      let instance;
      if (params.type === 'addon') {
        instance = emberAddon(project.baseDir, params.emberAppOptions);
      } else {
        instance = emberApp(project.baseDir, params.emberAppOptions);
      }

      params.embroiderOptions.workspaceDir = stableWorkspaceDir(instance.project.root);

      let addons = new Addons(instance, params.embroiderOptions);
      let tree;
      if (params.stage === 1) {
        tree = addons.tree;
      } else {
        let compatApp = new App(instance, addons, params.embroiderOptions);
        tree = compatApp.tree;
      }
      let builder = new Builder(tree);
      let builderPromise = builder.build();
      let results = await Promise.all([builderPromise, addons.ready()]);
      let basePath = results[1].outputPath;
      return new BuildResult(project, basePath, builder);
    } finally {
      process.chdir(origDir);
    }
  }
  private constructor(private project: Project, public outputPath: string, private builder: Builder) {
    this.transpile = this.transpile.bind(this);
    this.shouldTranspile = this.shouldTranspile.bind(this);
  }

  async cleanup() {
    this.project.dispose();
    await this.builder.cleanup();
  }

  transpile(contents: string, fileAssert: BoundExpectFile): string {
    if (fileAssert.path.endsWith('.hbs')) {
      return transform(hbsToJS(contents), Object.assign({ filename: fileAssert.fullPath }, this.babelConfig))!.code!;
    } else if (fileAssert.path.endsWith('.js')) {
      return transform(contents, Object.assign({ filename: fileAssert.fullPath }, this.babelConfig))!.code!;
    } else {
      return contents;
    }
  }

  // This allows our tests to simulate what a real Watcher would do, without
  // managing all the asynchrony of a real Watcher.
  //
  // This is necessary once you have BROCCOLI_ENABLED_MEMOIZE=true.
  async didChange(dir: string) {
    let node = this.builder.watchedSourceNodeWrappers.find(nw => nw.nodeInfo.sourceDirectory === dir);
    if (!node) {
      throw new Error(
        `test tried to simulated a watched file change in ${dir}, but we could not find the corresponding watched broccoli node`
      );
    }
    node.revise();
  }

  async rebuild() {
    let origDir = process.cwd();
    try {
      // this is here because EmberAddon makes a bad assumption that the project
      // root is always the current working directory
      process.chdir(this.project.baseDir);
      await this.builder.build();
    } finally {
      process.chdir(origDir);
    }
  }

  shouldTranspile(relativePath: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let shouldTranspile = require(join(this.outputPath, '_babel_filter_'));
    return shouldTranspile(join(this.outputPath, relativePath)) as boolean;
  }

  @Memoize()
  private get pkgJSON() {
    return readJSONSync(join(this.outputPath, 'package.json'));
  }

  private get emberMeta(): AppMeta {
    return this.pkgJSON['ember-addon'] as AppMeta;
  }

  @Memoize()
  private get babelConfig() {
    if (this.emberMeta['babel'].majorVersion !== 7) {
      throw new Error(`@embroider/test-support doesn't support babel 6 inside our app fixture tests`);
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(join(this.outputPath, this.emberMeta['babel'].filename)) as TransformOptions;
  }
}

function emberApp(dir: string, userOpts: any = {}): any {
  let cli = new MockCLI();
  let project = new EmberCLIProject(dir, readJSONSync(join(dir, 'package.json')), cli.ui, cli);
  return new EmberApp({ project }, userOpts);
}

function emberAddon(dir: string, userOpts: any = {}): any {
  let cli = new MockCLI();
  let project = new EmberCLIProject(dir, readJSONSync(join(dir, 'package.json')), cli.ui, cli);
  return new EmberAddon({ project }, userOpts);
}

class MockCLI {
  ui: any;
  root: string;
  npmPackage: string;
  instrumentation: Instrumentation;
  packageInfoCache: PackageInfoCache;
  constructor(options?: any) {
    options = options || {};

    this.ui = options.ui || new MockUI();
    this.root = join(__dirname, '..', '..');
    this.npmPackage = options.npmPackage || 'ember-cli';
    this.instrumentation = options.instrumentation || new Instrumentation({});
    this.packageInfoCache = new PackageInfoCache(this.ui);
  }
}
