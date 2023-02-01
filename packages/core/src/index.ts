export {
  Packager,
  PackagerConstructor,
  Variant,
  applyVariantToBabelConfig,
  getAppMeta,
  getPackagerCacheDir,
} from './packager';
export { HTMLEntrypoint, BundleSummary } from './html-entrypoint';
export { default as Stage } from './stage';
export { Asset, EmberAsset, ImplicitAssetPaths } from './asset';
export { default as Options, optionsWithDefaults } from './options';
export { default as toBroccoliPlugin } from './to-broccoli-plugin';
export { default as WaitForTrees, OutputPaths } from './wait-for-trees';
export { default as BuildStage } from './build-stage';
export { compile as jsHandlebarsCompile } from './js-handlebars';
export { AppAdapter, AppBuilder, EmberENV } from './app';
export { todo, unsupported, warn, debug, expectWarning, throwOnWarnings } from './messages';
export { mangledEngineRoot } from './engine-mangler';
export { Resolver, Options as ResolverOptions, Decision } from './module-resolver';

// this is reexported because we already make users manage a peerDep from some
// other packages (like embroider/webpack and @embroider/compat
export * from '@embroider/shared-internals';
