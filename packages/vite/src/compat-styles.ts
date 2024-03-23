import { ResolverLoader } from '@embroider/core';

export const function scss() {
  
  const resolverLoader = new ResolverLoader(process.cwd());
  
  const pathsImporter = () => {
    const addons = [];
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
    async function search(url) {
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
    return (url, prev, done) => {
      search(url).then(done).catch(e => done(null));
    };
  };

  return {
    alias: [],
    importer: [pathsImporter()]
  }
}
