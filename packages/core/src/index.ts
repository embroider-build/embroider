export {
  Packager,
  PackagerConstructor,
  Variant,
  applyVariantToBabelConfig,
  getAppMeta,
  getPackagerCacheDir,
} from './packager';
export { HTMLEntrypoint, BundleSummary } from './html-entrypoint';
export { Asset, EmberAsset, ImplicitAssetPaths } from './asset';
export { default as Options, optionsWithDefaults } from './options';
export { default as toBroccoliPlugin } from './to-broccoli-plugin';
export { default as WaitForTrees, OutputPaths } from './wait-for-trees';
export { compile as jsHandlebarsCompile } from './js-handlebars';
export { todo, unsupported, warn, debug, expectWarning, throwOnWarnings } from './messages';
export { mangledEngineRoot } from './engine-mangler';
export {
  Resolver,
  Options as ResolverOptions,
  ModuleRequest,
  Resolution,
  ResolverFunction,
  SyncResolverFunction,
} from './module-resolver';
export { virtualContent } from './virtual-content';
export type { Engine } from './app-files';
export { outputTree } from './output-tree';

// this is reexported because we already make users manage a peerDep from some
// other packages (like embroider/webpack and @embroider/compat
export * from '@embroider/shared-internals';
