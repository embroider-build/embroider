/**
 * The subset of the ember-cli and v2 addon types that addon-shim uses.
 *
 * These are copies of the types in @embroider/shared-internals.
 *
 * The copy keeps that package and its dependencies
 * out of the install of every v2 addon.
 */

type Filename = string;
type AppRelativeURL = string;

export interface AddonMeta {
  main?: string;
  'order-index'?: number;
  'lazy-engine'?: boolean;

  'auto-upgraded'?: true;
  'app-js'?: { [appName: string]: Filename };
  'fastboot-js'?: { [appName: string]: Filename };
  'implicit-modules'?: string[];
  'implicit-scripts'?: Filename[];
  'implicit-styles'?: Filename[];
  'implicit-test-modules'?: string[];
  'implicit-test-scripts'?: Filename[];
  'implicit-test-styles'?: Filename[];
  'public-assets'?: {
    [filename: string]: AppRelativeURL;
  };
  'renamed-packages'?: { [fromName: string]: string };
  'renamed-modules'?: { [fromName: string]: string };
  version: 2;
}

export interface PackageInfo {
  name: string;
  version: string;
  'ember-addon'?: AddonMeta | { version?: 1 };
}

interface Project {
  pkg: PackageInfo;
  root: string;
  addons: AddonInstance[];
  name(): string;
}

interface AppInstance {
  project: Project;
  options: any;
}

interface BaseAddonInstance {
  project: Project;
  pkg: PackageInfo;
  app: {
    options: any;
  };
  root: string;
  options: any;
  addons: AddonInstance[];
  name: string;
  _super: any;
  treeGenerator(path: string): unknown;
  _findHost(): AppInstance;
}

export interface DeepAddonInstance extends BaseAddonInstance {
  parent: AddonInstance;
}

export interface ShallowAddonInstance extends BaseAddonInstance {
  parent: Project;
  app: AppInstance;
}

export type AddonInstance = DeepAddonInstance | ShallowAddonInstance;

export function isDeepAddonInstance(
  addon: AddonInstance
): addon is DeepAddonInstance {
  return addon.parent !== addon.project;
}
