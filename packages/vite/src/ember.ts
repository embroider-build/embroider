import { templateTag } from './template-tag.js';
import { resolver } from './resolver.js';
import { type UserConfig, type ConfigEnv } from 'vite';
import { esBuildResolver } from './esbuild-resolver.js';

export let extensions = ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'];

export function ember() {
  return [
    templateTag(),
    resolver(),
    {
      name: 'vite-plugin-ember-config',
      async config(config: UserConfig, env: ConfigEnv) {
        // Default vite resolve extensions, which the user can completely
        // override if they want
        if (!config.resolve) {
          config.resolve = {};
        }
        if (!config.resolve.extensions) {
          config.resolve.extensions = extensions;
        }

        // Our esbuild integration only works if these extensions are
        // configured, so we force them in
        if (!config.optimizeDeps) {
          config.optimizeDeps = {};
        }
        if (!config.optimizeDeps.extensions) {
          config.optimizeDeps.extensions = [];
        }
        for (let requiredExt of ['.hbs', '.gjs', '.gts']) {
          if (!config.optimizeDeps.extensions.includes(requiredExt)) {
            config.optimizeDeps.extensions.push(requiredExt);
          }
        }

        // @embroider/macros needs to not go through dep optimization
        if (config.optimizeDeps.exclude) {
          config.optimizeDeps.exclude.push('@embroider/macros');
        } else {
          config.optimizeDeps.exclude = ['@embroider/macros'];
        }

        // configure out esbuild resolver
        if (!config.optimizeDeps.esbuildOptions) {
          config.optimizeDeps.esbuildOptions = {};
        }
        if (config.optimizeDeps.esbuildOptions.plugins) {
          config.optimizeDeps.esbuildOptions.plugins.push(esBuildResolver());
        } else {
          config.optimizeDeps.esbuildOptions.plugins = [esBuildResolver()];
        }

        if (!config.build) {
          config.build = {};
        }

        if (!config.build.rollupOptions) {
          config.build.rollupOptions = {};
        }

        // we provide a default build.rollupOptions.input that builds index.html
        // and, in non-production or when forcing tests, tests/index.html. But
        // the user may choose to take charge of input entirely.
        if (!config.build.rollupOptions.input) {
          config.build.rollupOptions.input = {
            main: 'index.html',
            ...(shouldBuildTests(env.mode) ? { tests: 'tests/index.html' } : undefined),
          };
        }

        if (!config.server) {
          config.server = {};
        }

        // Traditional ember development port as default.
        if (config.server.port == null) {
          config.server.port = 4200;
        }

        // vite will try to transpile away typescript in .ts files using
        // esbuild. But if we have any typescript, we expect it to get handled
        // by babel, because we don't want esbuild's decorator implementation.
        if (config.esbuild == null) {
          config.esbuild = false;
        }

        minification(config, env.mode);
      },
    },
  ];
}

function shouldBuildTests(mode: string) {
  return mode !== 'production' || process.env.FORCE_BUILD_TESTS;
}

function minification(config: UserConfig, mode: string) {
  if (mode !== 'production') {
    return;
  }

  /**
   * Outside of test, the only other time "build" is used,
   * is production
   */
  config.build ||= {};

  if (config.build.minify === undefined) {
    config.build.minify = 'terser';
  }

  if (config.build.minify === 'terser' && !config.build.terserOptions) {
    config.build.terserOptions = {
      module: true,
      compress: {
        passes: 3,
        keep_fargs: false,
        keep_fnames: false,
        toplevel: true,
      },
    };
  }
}
