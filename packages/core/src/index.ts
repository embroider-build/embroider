export {
  Packager,
  PackagerConstructor,
  Variant,
  applyVariantToBabelConfig,
  applyVariantToTemplateCompiler,
  getAppMeta,
  getPackagerCacheDir,
} from './packager';
export { HTMLEntrypoint, BundleSummary } from './html-entrypoint';
export { Resolver } from './resolver';
export { default as Stage } from './stage';
export { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
export { TemplateCompiler, TemplateCompilerParams } from './template-compiler-common';
export { templateCompilerModule } from './write-template-compiler';
export { Plugins as TemplateCompilerPlugins } from './ember-template-compiler-types';
export { Asset, EmberAsset, ImplicitAssetPaths } from './asset';
export { default as Options, optionsWithDefaults } from './options';
export { default as toBroccoliPlugin } from './to-broccoli-plugin';
export { default as WaitForTrees, OutputPaths } from './wait-for-trees';
export { default as BuildStage } from './build-stage';
export { compile as jsHandlebarsCompile } from './js-handlebars';
export { AppAdapter, AppBuilder, EmberENV } from './app';
export { todo, unsupported, warn, debug, expectWarning, throwOnWarnings } from './messages';
export { mangledEngineRoot } from './engine-mangler';

// this is reexported because we already make users manage a peerDep from some
// other packages (like embroider/webpack and @embroider/
export * from '@embroider/shared-internals';
