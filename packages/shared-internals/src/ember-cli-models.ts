import type { Funnel } from 'broccoli-funnel';
import type { Node } from 'broccoli-node-api';
import { join } from 'path';
import { PackageInfo } from './metadata';
export interface Project {
  targets: unknown;
  ui: {
    write(...args: any[]): void;
  };
  pkg: PackageInfo;
  root: string;
  addons: AddonInstance[];
  name(): string;
  configPath(): string;
}

export interface AppInstance {
  env: 'development' | 'test' | 'production';
  project: Project;
  options: any;
  addonPostprocessTree: (which: string, tree: Node) => Node;
  import(path: string, opts?: { type?: string }): void;
  toTree(additionalTrees?: Node[]): Node;
}

export type FilePath = string;
export type OutputFileToInputFileMap = { [filePath: string]: FilePath[] };

interface PreprocessPlugin {
  name: string;
  ext: string;
}
export interface EmberCliPreprocessRegistry {
  extensionsForType(type: string): string[];
  load(type: string): PreprocessPlugin[];
  registeredForType(type: string): PreprocessPlugin[];
  add(type: string, plugin: PreprocessPlugin): void;
  remove(type: string, pluginName: string): void;
}

export interface EmberAppInstance {
  env: 'development' | 'test' | 'production';
  name: string;
  _scriptOutputFiles: OutputFileToInputFileMap;
  _styleOutputFiles: OutputFileToInputFileMap;
  legacyTestFilesToAppend: FilePath[];
  vendorTestStaticStyles: FilePath[];
  _customTransformsMap: Map<string, any>;
  _nodeModules: Map<string, { name: string; path: FilePath }>;
  options: any;
  tests: boolean;
  trees: any;
  project: Project;
  registry: EmberCliPreprocessRegistry;
  testIndex(): Node;
  getLintTests(): Node;
  otherAssetPaths: any[];
  addonPostprocessTree: (which: string, tree: Node) => Node;
  import(path: string, opts?: { type?: string }): void;
  toTree(additionalTrees?: Node[]): Node;
}

interface BaseAddonInstance {
  registry: EmberCliPreprocessRegistry;
  project: Project;
  pkg: PackageInfo;
  app: {
    options: any;
  };
  root: string;
  options: any;
  addons: AddonInstance[];
  name: string;
  _name: string;
  _super: any;
  _meta_: any;
  _buildFastbootConfigTree(config: any): Node;
  _shouldIncludeFiles(): boolean;
  outputReady(config: any): any;
  moduleName?(): string;
  shouldCompileTemplates(): boolean;
  isDevelopingAddon?(): boolean;
  hintingEnabled(): boolean;
  jshintAddonTree(): Node | undefined;
  preprocessJs(tree: Node, sep: any, moduleName: any, config: any): Node;
  compileStyles(tree: Node): Node;
  cacheKeyForTree?(treeName: string): string;
  getEngineConfigContents?(): any;
  engineConfig?(env: string, config: any): any;
  treeGenerator(path: string): Node;
  treeForFastBoot(tree: Funnel | undefined): Node | undefined;
  _findHost(): AppInstance;
  _treeFor(treeName: string): Node;
  treePaths: {
    // app: string;
    // styles: string;
    // templates: string;
    // addon: 'addon';
    // 'addon-styles': string;
    // 'addon-templates': string;
    // vendor: string;
    // 'test-support': string;
    // 'addon-test-support': string;
    // public: string;

    addon: string;
    'addon-styles': string;
    styles: string;
    'addon-test-support': string;
    'test-support': string;
    app: string;
    public: string;
    vendor: string;
  };
}

export type AddonTreePath = keyof BaseAddonInstance['treePaths'];

export interface DeepAddonInstance extends BaseAddonInstance {
  // this is how it looks when an addon is beneath another addon
  parent: AddonInstance;
}

export interface ShallowAddonInstance extends BaseAddonInstance {
  // this is how it looks when an addon is directly beneath the app
  parent: Project;
  app: AppInstance;
}

export type AddonInstance = DeepAddonInstance | ShallowAddonInstance;

export function isDeepAddonInstance(addon: AddonInstance): addon is DeepAddonInstance {
  return addon.parent !== addon.project;
}

export function findTopmostAddon(addon: AddonInstance): ShallowAddonInstance {
  if (isDeepAddonInstance(addon)) {
    return findTopmostAddon(addon.parent);
  } else {
    return addon;
  }
}

// this can differ from appInstance.project.root because Dummy apps are terrible
export function getAppRoot(appInstance: AppInstance): string {
  // this is the Known Hack for finding the true root of the dummy app.
  return join(appInstance.project.configPath(), '..', '..');
}
