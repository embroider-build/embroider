import { ResolverLoader } from '@embroider/core';
import { join } from 'path';
import { existsSync } from 'fs';

export function compatScss() {
  const resolverLoader = new ResolverLoader(process.cwd());
  const weakMap = new WeakMap();
  function getAddons() {
    if (weakMap.has(resolverLoader.resolver)) {
      return weakMap.get(resolverLoader.resolver);
    }
    const addons: string[] = [];
    for (const engine of resolverLoader.resolver.options.engines) {
      for (const activeAddon of engine.activeAddons) {
        const stylesFolder = join(activeAddon.root, '_app_styles_');
        if (existsSync(stylesFolder)) {
          addons.push(stylesFolder);
        } else {
          addons.push(activeAddon.root);
        }
      }
    }
    weakMap.set(resolverLoader.resolver, addons);
    return addons;
  }

  const pathsImporter = () => {
    async function search(url: string) {
      if (existsSync(url)) {
        return null;
      }
      const addons = getAddons();
      for (const p of addons) {
        let newPath = join(p, url);
        if (!newPath.endsWith('.scss') && !newPath.endsWith('.sass') && !newPath.endsWith('.css')) {
          newPath += '.scss';
        }
        if (existsSync(newPath)) {
          return {
            file: newPath,
          };
        }
      }
      return null;
    }
    return (url: string, _prev: any, done: any) => {
      search(url)
        .then(done)
        .catch(() => done(null));
    };
  };

  return {
    alias: [],
    importer: [pathsImporter()],
    includePaths: [process.cwd(), join(process.cwd(), 'node_modules')],
  };
}
