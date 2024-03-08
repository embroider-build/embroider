import { ResolverLoader } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
import send from 'send';
import type { Plugin } from 'vite';

export function publicAssets(): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  const excludedUrls = ['/@fs', '/@id/embroider_virtual:', '/@vite/client'];
  return {
    name: 'embroider-public-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // TODO: Is there another way to handle the minimum amount of requests (without forcing the user to list the addons)?
        if (!req.originalUrl || req.originalUrl === '/' || excludedUrls.find(url => req.originalUrl.includes(url)))
          return next();

        // TODO: Is it the right thing to look at?
        let appActiveAddons = resolverLoader.resolver.options.engines[0].activeAddons;
        let maybeAddonName = req.originalUrl.split('/')[1];
        let ownerAddon = appActiveAddons.find(({ name }) => name === maybeAddonName);
        if (!ownerAddon) return next();

        let ownerAddonConfig = readFileSync(`${ownerAddon.root}/package.json`);
        let ownerAddonAssets = JSON.parse(ownerAddonConfig.toString())['ember-addon']['public-assets'];
        let pathInAddon = Object.keys(ownerAddonAssets).find(leftPath =>
          // public-assets can contain "./my-url" for "/my-url" request, so we can't use === operator
          ownerAddonAssets[leftPath].includes(req.originalUrl)
        );
        if (!pathInAddon) return next();

        // @ts-ignore TODO: how to handle the types properly?
        send(req, join(ownerAddon.root, pathInAddon)).pipe(res);
      });
    },
  };
}
