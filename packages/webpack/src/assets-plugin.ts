import type { Compiler, Compilation } from 'webpack';
import { ResolverLoader } from '@embroider/core';
import fs from 'fs-extra';
const { existsSync, readFileSync, lstatSync } = fs;
import { join, posix } from 'path';

// The webpack equivalent of vite's `assets` plugin: copies the public assets
// declared by v2 addons (via their `public-assets` meta) into the build,
// unless the app overrides them in its own public/ directory.
export class AssetsPlugin {
  constructor(private appRoot: string, private publicDir = 'public') {}

  apply(compiler: Compiler) {
    const resolverLoader = new ResolverLoader(this.appRoot);

    compiler.hooks.thisCompilation.tap('embroider-assets', (compilation: Compilation) => {
      const { Compilation, sources } = compiler.webpack;
      compilation.hooks.processAssets.tap(
        {
          name: 'embroider-assets',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const engines = resolverLoader.resolver.options.engines;
          for (const engine of engines) {
            for (const addon of engine.activeAddons) {
              const pkg = resolverLoader.resolver.packageCache.ownerOfFile(addon.root);
              if (!pkg || !pkg.isV2Addon()) {
                continue;
              }
              const assets = pkg.meta['public-assets'] || {};
              for (const [path, dest] of Object.entries(assets)) {
                const destRel = posix.resolve('/', dest as string).slice(1);
                if (existsSync(join(this.appRoot, this.publicDir, destRel))) {
                  continue;
                }
                const filePath = join(pkg.root, path);
                if (!existsSync(filePath) || !lstatSync(filePath).isFile()) {
                  console.log(`Invalid public-assets entry: ${pkg.name} declared "${path}" which is not a file`);
                  continue;
                }
                if (!compilation.getAsset(destRel)) {
                  compilation.emitAsset(destRel, new sources.RawSource(readFileSync(filePath)));
                }
              }
            }
          }
        }
      );
    });
  }
}
