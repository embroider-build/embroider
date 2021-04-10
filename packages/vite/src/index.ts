import { realpathSync } from 'fs';
import { copyFile } from 'fs-extra';
import { join } from 'path';
import {
  HTMLEntrypoint,
  Packager,
  PackagerConstructor,
  Variant,
  applyVariantToBabelConfig,
  getAppMeta,
  getPackagerCacheDir,
} from '@embroider/core';
import { build } from 'vite';
import templateCompilerPlugin from '@embroider/rollup-plugin-hbs';
import { babel } from '@rollup/plugin-babel';
import { AllowedViteConfig, Options } from './options';

const Vite: PackagerConstructor<Options> = class Vite implements Packager {
  static annotation = '@embroider/vite';

  private pathToVanillaApp: string;
  private variant: Variant;
  private viteConfig: AllowedViteConfig;

  constructor(
    inputPath: string,
    private outputPath: string,
    variants: Variant[],
    _consoleWrite: (msg: string) => void,
    options?: Options
  ) {
    this.pathToVanillaApp = realpathSync(inputPath);

    // For now we're not worried about building each variant
    // Let's just assume we have one
    this.variant = variants[0];

    this.viteConfig = options?.viteConfig ?? {};
  }

  async build(): Promise<void> {
    const meta = getAppMeta(this.pathToVanillaApp);
    const entrypoints: HTMLEntrypoint[] = [];
    const otherAssets: string[] = [];
    const rootURL = meta['root-url'];

    for (let relativePath of meta.assets) {
      if (/\.html/i.test(relativePath)) {
        entrypoints.push(new HTMLEntrypoint(this.pathToVanillaApp, rootURL, '/', relativePath));
      } else {
        otherAssets.push(relativePath);
      }
    }

    await build({
      // Options we want to override the defaults for, but users can override themselves, too
      logLevel: 'error',

      // User options
      ...this.viteConfig,

      // Options we *don't* want to allow users to override
      base: meta['root-url'],
      cacheDir: getPackagerCacheDir('vite'),
      configFile: false,
      mode: this.variant.optimizeForProduction ? 'production' : 'development',
      resolve: {
        ...this.viteConfig.resolve,
        extensions: meta['resolvable-extensions'],
      },
      root: this.pathToVanillaApp,

      build: {
        ...this.viteConfig.build,
        outDir: this.outputPath,
        rollupOptions: {
          ...this.viteConfig.build?.rollupOptions,
          input: entrypoints.map(entry => join(this.pathToVanillaApp, entry.filename)),
        },
        commonjsOptions: {
          ...this.viteConfig.build?.commonjsOptions,
          extensions: meta['resolvable-extensions'],
          include: [/.*/],
        },
      },

      plugins: [
        templateCompilerPlugin({
          templateCompilerFile: join(this.pathToVanillaApp, meta['template-compiler'].filename),
          variant: this.variant,
        }),

        babel({
          // Embroider includes the Runtime plugin in the generated Babel config
          babelHelpers: 'runtime',

          // Path to the Embroider-generated file defining a filtering function
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          filter: require(join(this.pathToVanillaApp, meta.babel.fileFilter)),

          // Add the Babel config produced by Embroider
          ...this.getBabelConfig(meta.babel.filename),
        }),

        ...(this.viteConfig.plugins ?? []),
      ],
    });

    await Promise.all([
      // Vite does not process non-module scripts, so we need to copy them over
      ...entrypoints
        .reduce((acc, entrypoint) => [...acc, ...entrypoint.scripts], [] as string[])
        .map(script => this.copyThrough(script)),

      // Copy over other assets
      // This more-or-less mimics what Vite does for `public` files
      ...otherAssets.map(relativePath => this.copyThrough(relativePath)),
    ]);
  }

  private copyThrough(path: string) {
    const source = join(this.pathToVanillaApp, path);
    const dest = join(this.outputPath, path);

    return copyFile(source, dest);
  }

  private getBabelConfig(configFileName: string) {
    const appBabelConfigPath = join(this.pathToVanillaApp, configFileName);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return applyVariantToBabelConfig(this.variant, require(appBabelConfigPath));
  }
};

export { Vite };
