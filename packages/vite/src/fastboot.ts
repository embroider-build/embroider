import { locateEmbroiderWorkingDir, virtualContent, ResolverLoader } from '@embroider/core';
import { readFileSync, readJSONSync } from 'fs-extra';
import { join, resolve } from 'path';
import type { Plugin } from 'vite';

function hasFastboot(resolverLoader: ResolverLoader) {
  const app = resolverLoader.resolver.options.engines[0];
  return app.activeAddons.find(addon => addon.name === 'ember-cli-fastboot');
}

export function fastboot(): Plugin {
  return {
    name: 'embroider-fastboot',

    buildEnd: {
      // we need to wait for the compatBuild plugin's buildStart hook to finish
      // so that the resolver config exists before we try to read it.
      sequential: true,
      order: 'post',
      async handler() {
        const resolverLoader = new ResolverLoader(process.cwd());
        if (hasFastboot(resolverLoader)) {
          this.emitFile({
            type: 'asset',
            fileName: 'assets/embroider_macros_fastboot_init.js',
            source: virtualContent('assets/embroider_macros_fastboot_init.js', resolverLoader.resolver).src,
          });
          // TODO: don't rely on rewritten-app
          this.emitFile({
            type: 'asset',
            fileName: 'package.json',
            source: readFileSync(resolve(locateEmbroiderWorkingDir(process.cwd()), 'rewritten-app', 'package.json')),
          });
        }
      },
    },

    transformIndexHtml: {
      async handler(/* html, { path }*/) {
        const resolverLoader = new ResolverLoader(process.cwd());
        if (hasFastboot(resolverLoader)) {
          let config: any = readJSONSync(join(locateEmbroiderWorkingDir(process.cwd()), 'fastboot.json'));
          console.log(config);
          // <script src="@embroider/core/vendor.js" ></script>
          // config.extraVendorFiles
          //
          // <script src="@embroider/core/entrypoint" type="module"></script>
          // config.extraAppFiles
        }
      },
    },
  };
}
