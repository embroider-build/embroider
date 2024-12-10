import { templateTag } from './template-tag.js';
import { resolver } from './resolver.js';
import { mergeConfig, type UserConfig, type ConfigEnv } from 'vite';
import { esBuildResolver } from './esbuild-resolver.js';

export let extensions = ['.mjs', '.gjs', '.js', '.mts', '.gts', '.ts', '.hbs', '.hbs.js', '.json'];

export function ember() {
  return [
    templateTag(),
    resolver(),
    {
      name: 'vite-plugin-ember-config',
      async config(config: UserConfig, env: ConfigEnv) {
        return mergeConfig(
          {
            resolve: {
              extensions,
            },

            optimizeDeps: {
              exclude: ['@embroider/macros'],
              extensions: ['.hbs', '.gjs', '.gts'],
              esbuildOptions: {
                plugins: [esBuildResolver()],
              },
            },

            build: {
              rollupOptions: {
                input: {
                  main: 'index.html',
                  ...(shouldBuildTests(env.mode) ? { tests: 'tests/index.html' } : undefined),
                },
              },
            },
            server: {
              port: 4200,
            },
          },
          config
        );
      },
    },
  ];
}

function shouldBuildTests(mode: string) {
  return mode !== 'production' || process.env.FORCE_BUILD_TESTS;
}
