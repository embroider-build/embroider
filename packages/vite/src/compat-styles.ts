import { ResolverLoader } from '@embroider/core';
import { join } from 'path';
import { existsSync } from 'fs';

export function compatScss() {

  const resolverLoader = new ResolverLoader(process.cwd());

  const pathsImporter = () => {
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
    async function search(url: string) {
      if (existsSync(url)) {
        return null;
      }
      for (const p of addons) {
        let newPath = join(p, url);
        if (!newPath.endsWith('.scss') && !newPath.endsWith('.sass') && !newPath.endsWith('.css')) {
          newPath += '.scss';
        }
        if (existsSync(newPath)) {
          return {
            file: newPath
          };
        }
      }
      return null
    }
    return (url: string, _prev: any, done: any) => {
      search(url).then(done).catch(() => done(null));
    };
  };

  return {
    alias: [],
    importer: [pathsImporter()],
    includePaths: [
      process.cwd(),
      join(process.cwd(), 'node_modules'),
    ],
  }
}
