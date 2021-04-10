import { BuildOptions, InlineConfig } from 'vite';

type CommonJSOptions = Required<BuildOptions['commonjsOptions']>;
type ResolveOptions = Required<InlineConfig['resolve']>;
type RollupOptions = Required<BuildOptions['rollupOptions']>;

type AllowedCommonJSOptions = Omit<CommonJSOptions, 'extensions' | 'include'>;
type AllowedResolveOptions = Omit<ResolveOptions, 'extensions'>;
type AllowedRollupOptions = Omit<RollupOptions, 'input'>;

type AllowedBuildOptions = Omit<BuildOptions, 'commonjsOptions' | 'outDir' | 'rollupOptions'> & {
  commonjsOptions?: AllowedCommonJSOptions;
  rollupOptions?: AllowedRollupOptions;
};

export type AllowedViteConfig = Omit<
  InlineConfig,
  'base' | 'build' | 'cacheDir' | 'configFile' | 'mode' | 'resolve' | 'root'
> & {
  build?: AllowedBuildOptions;
  resolve?: AllowedResolveOptions;
};

export interface Options {
  viteConfig?: AllowedViteConfig;
}
