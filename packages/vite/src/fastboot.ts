import { locateEmbroiderWorkingDir, virtualContent, ResolverLoader } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { resolve } from 'path';
import type { Plugin } from 'vite';

export function fastboot(): Plugin {
  let resolverLoader = new ResolverLoader(process.cwd());

  return {
    name: 'embroider-fastboot',

    buildEnd: {
      // we need to wait for the compatBuild plugin's buildStart hook to finish
      // so that the resolver config exists before we try to read it.
      sequential: true,
      order: 'post',
      async handler() {
        const app = resolverLoader.resolver.options.engines[0];
        const hasFastboot = app.activeAddons.find(addon => addon.name === 'ember-cli-fastboot');
        if (hasFastboot) {
          this.emitFile({
            type: 'asset',
            fileName: 'assets/embroider_macros_fastboot_init.js',
            source: virtualContent('assets/embroider_macros_fastboot_init.js', resolverLoader.resolver).src,
          });
        }
      },
    },
  };
}
