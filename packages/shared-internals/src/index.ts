export { type AppMeta, type AddonMeta, type PackageInfo } from './metadata';
export { explicitRelative, extensionsPattern, unrelativize, cleanUrl } from './paths';
export { getOrCreate } from './get-or-create';
export {
  default as Package,
  type V2AddonPackage as AddonPackage,
  type V2AppPackage as AppPackage,
  type V2Package,
} from './package';
export { default as PackageCache } from './package-cache';
export type { RewrittenPackageIndex } from './rewritten-package-cache';
export { RewrittenPackageCache } from './rewritten-package-cache';
export { default as babelFilter } from './babel-filter';
export { default as packageName } from './package-name';
export { default as tmpdir } from './tmpdir';
export * from './ember-cli-models';
export * from './ember-standard-modules';
export { hbsToJS } from './hbs-to-js';
export {
  default as templateColocationPlugin,
  type Options as TemplateColocationPluginOptions,
  pluginPath as templateColocationPluginPath,
} from './template-colocation-plugin';

export {
  default as cacheBustingPlugin,
  pluginPath as cacheBustingPluginPath,
  version as cacheBustingPluginVersion,
} from './babel-plugin-cache-busting';
export { locateEmbroiderWorkingDir } from './working-dir';

export * from './dep-validation';
