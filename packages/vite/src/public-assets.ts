import { ResolverLoader } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
import send from 'send';
import type { Plugin } from 'vite';

export function publicAssets(): Plugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  return {
    name: 'embroider-public-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // TODO: How to handle only public-assets?
        if (req.originalUrl === '/ember-welcome-page/images/construction.png') {
          let appActiveAddons = resolverLoader.resolver.options.engines[0].activeAddons;
          let ownerAddon = appActiveAddons.find(({ name }) => name === 'ember-welcome-page');
          if (ownerAddon) {
            let ownerAddonConfig = readFileSync(`${ownerAddon.root}/package.json`);
            let ownerAddonAssets = JSON.parse(ownerAddonConfig.toString())['ember-addon']['public-assets'];
            let pathInAddon = Object.keys(ownerAddonAssets).find(
              leftPath => ownerAddonAssets[leftPath] === req.originalUrl
            );
            if (pathInAddon) {
              console.log(join(ownerAddon.root, pathInAddon));
              // @ts-ignore (TODO: how to handle the types properly?)
              send(req, join(ownerAddon.root, pathInAddon)).pipe(res);
            }
          }
        }
        next();
      });
    },
  };
}
