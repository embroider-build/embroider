import { ResolverLoader } from '@embroider/core';
import { existsSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import send from 'send';
import type { Plugin } from 'vite';

// This Vite middleware relies on the ResolverLoader to locate the public assets in app and addons
export function publicAssets(): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  const resolverOptions = resolverLoader.resolver.options;
  const excludedUrls = ['/@fs', '/@id/embroider_virtual:', '/@vite/client'];
  return {
    name: 'embroider-public-assets',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // TODO: Is there another way to handle the minimum amount of requests (without forcing the user to list the addons)?
        if (!req.originalUrl || req.originalUrl === '/' || excludedUrls.find(url => req.originalUrl.includes(url)))
          return next();

        let maybePublic = `${resolverOptions.appRoot}/public${req.originalUrl}`;
        if (existsSync(maybePublic)) {
          // @ts-ignore TODO: how to handle the types properly?
          return send(req, maybePublic).pipe(res);
        }

        // TODO: Is it the right thing to look at?
        let appActiveAddons = resolverOptions.engines[0].activeAddons;
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
