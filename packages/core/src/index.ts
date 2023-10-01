export {
  type Packager,
  type PackagerConstructor,
  type Variant,
  applyVariantToBabelConfig,
  getAppMeta,
  getPackagerCacheDir,
} from './packager';
export { HTMLEntrypoint, type BundleSummary } from './html-entrypoint';
export { type default as Stage } from './stage';
export { type Asset, type EmberAsset, type ImplicitAssetPaths } from './asset';
export { type default as Options, optionsWithDefaults } from './options';
export { default as toBroccoliPlugin } from './to-broccoli-plugin';
export { default as WaitForTrees, type OutputPaths } from './wait-for-trees';
export { compile as jsHandlebarsCompile } from './js-handlebars';
export { todo, unsupported, warn, debug, expectWarning, throwOnWarnings } from './messages';
export {
  Resolver,
  type Options as ResolverOptions,
  type ModuleRequest,
  type Resolution,
  type ResolverFunction,
  type SyncResolverFunction,
} from './module-resolver';
export { ResolverLoader } from './resolver-loader';
export { virtualContent } from './virtual-content';
export type { Engine } from './app-files';

// this is reexported because we already make users manage a peerDep from some
// other packages (like embroider/webpack and @embroider/compat
export * from '@embroider/shared-internals';
