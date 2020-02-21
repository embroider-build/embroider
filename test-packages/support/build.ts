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
import { BoundFileAssert } from './file-assertions';
import { TemplateCompiler, AppMeta, AppBuilder } from '@embroider/core';
import { MacrosConfig } from '@embroider/macros';
import { Memoize } from 'typescript-memoize';

export interface BuildParams {
  stage: 1 | 2;
  type: 'app' | 'addon';
  emberAppOptions: any;
  embroiderOptions: Options;
}

const defaultParams = {
  stage: 1,
  type: 'app',
  emberAppOptions: {},
  embroiderOptions: {},
};

export default class BuildResult {
  static async build(project: Project, params: Partial<BuildParams>) {
    MacrosConfig.reset();
    let paramsWithDefaults: BuildParams = Object.assign({}, params, defaultParams);
    project.writeSync();
    let instance;
    if (paramsWithDefaults.type === 'addon') {
      instance = emberAddon(project.baseDir, params.emberAppOptions);
    } else {
      instance = emberApp(project.baseDir, params.emberAppOptions);
    }
    let addons = new Addons(instance, params.embroiderOptions);
    let tree;
    AppBuilder.finalizeMacroConfig(instance);
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
  }
  private constructor(private project: Project, public outputPath: string, private builder: Builder) {
    this.transpile = this.transpile.bind(this);
    this.shouldTranspile = this.shouldTranspile.bind(this);
  }

  async cleanup() {
    await this.project.dispose();
    await this.builder.cleanup();
  }

  transpile(contents: string, fileAssert: BoundFileAssert) {
    if (fileAssert.path.endsWith('.hbs')) {
      return this.templateCompiler.compile(fileAssert.fullPath, contents);
    } else if (fileAssert.path.endsWith('.js')) {
      return transform(contents, Object.assign({ filename: fileAssert.fullPath }, this.babelConfig))!.code!;
    } else {
      return contents;
    }
  }

  async rebuild() {
    await this.builder.build();
  }

  shouldTranspile(fileAssert: BoundFileAssert) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    let shouldTranspile = require(join(this.outputPath, '_babel_filter_'));
    return shouldTranspile(fileAssert.fullPath) as boolean;
  }

  @Memoize()
  private get pkgJSON() {
    return readJSONSync(join(this.outputPath, 'package.json'));
  }

  private get emberMeta(): AppMeta {
    return this.pkgJSON['ember-addon'] as AppMeta;
  }

  @Memoize()
  private get templateCompiler() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(join(this.outputPath, this.emberMeta['template-compiler'].filename)) as TemplateCompiler;
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
