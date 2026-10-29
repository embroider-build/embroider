export { default as App } from './compat-app';
export { default as Addons } from './compat-addons';
export { default as Options, recommendedOptions, compatOptions } from './options';
export { defineConfig, validateConfig } from './config';
export { default as V1Addon } from './v1-addon';
export { prebuild, compatBuild } from './default-pipeline';
export { PackageRules } from './dependency-rules';
export type { Options as ResolverTransformOptions } from './resolver-transform';
