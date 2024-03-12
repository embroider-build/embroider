import { ResolverLoader } from '@embroider/core';
import { existsSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import send from 'send';
import type { Plugin } from 'vite';

// This Vite plugin relies on the ResolverLoader to locate the public assets in app and addons
export function publicAssets(): Plugin {
  const resolverLoader = new ResolverLoader(process.cwd());
  const resolverOptions = resolverLoader.resolver.options;
  const excludedUrls = ['/@fs', '/@id/embroider_virtual:', '/@vite/client'];

  let publicAssetsMap = new Map();

  return {
    name: 'embroider-public-assets',

    buildStart() {
      // We build a map of all public assets referenced in the active addons,
      // regardless they are actively used in the app. The key is the requested
      // URL when the asset is used, and the value is the full path to locate it.
      let appActiveAddons = resolverOptions.engines[0].activeAddons;
      for (const addon of appActiveAddons) {
        let addonConfig = readFileSync(`${addon.root}/package.json`);
        let addonAssets = JSON.parse(addonConfig.toString())['ember-addon']['public-assets'];
        if (addonAssets) {
          for (const [leftPath, rightPath] of Object.entries(addonAssets)) {
            publicAssetsMap.set(join('.', `${rightPath}`), join(addon.root, leftPath));
          }
        }
      }
    },

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

        // TODO: the map contains an entry '/assets/vite-app.css' from package '/@embroider/synthesized-styles'
        // Not sure we want this?
        let maybeAddonAsset = publicAssetsMap.get(join('.', req.originalUrl));
        if (!maybeAddonAsset) return next();
        // @ts-ignore TODO: how to handle the types properly?
        send(req, maybeAddonAsset).pipe(res);
      });
    },
  };
}
