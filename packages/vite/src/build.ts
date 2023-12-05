import type { Plugin } from 'vite';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import type { AddonMeta } from '@embroider/core';
import { ResolverLoader } from '@embroider/core';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { copyFileSync, mkdirpSync, rmdirSync, rmSync, writeFileSync } from 'fs-extra';

const cwd = process.cwd();
const embroiderDir = join(cwd, 'node_modules', '.embroider');
const cacheKeyPath = join(embroiderDir, 'cache-key.json');

export const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'package.json'];

function getCacheKey(file: string) {
  if (existsSync(cacheKeyPath)) {
    return JSON.parse(readFileSync(cacheKeyPath).toString())[file];
  }
  return null;
}

function updateCacheKey(file: string, key: string | null) {
  let json: Record<string, string | null> = {};
  if (existsSync(cacheKeyPath)) {
    json = JSON.parse(readFileSync(cacheKeyPath).toString());
  }
  json[file] = key;
  writeFileSync(cacheKeyPath, JSON.stringify(json));
}

function computeCacheKeyForFile(file: string) {
  if (existsSync(file)) {
    const fileBuffer = readFileSync(file);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);

    return hashSum.digest('hex');
  }
  return null;
}

export function emberBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = fork('./node_modules/ember-cli/bin/ember', ['build']);
    child.on('exit', code => (code === 0 ? resolve() : reject()));
  });
}

export async function buildIfFileChanged(path: string | null | undefined): Promise<void> {
  if (path && (lockFiles.includes(path) || path === 'app/index.html')) {
    const key = computeCacheKeyForFile(path);
    if (key !== getCacheKey(path)) {
      console.log(path + ' change requires rebuild, rebuilding...');
      await emberBuild();
      updateCacheKey(path, key);
    }
  }
}

export function build(): Plugin {
  let resolverLoader = new ResolverLoader(process.cwd());
  const engine = resolverLoader.resolver.options.engines[0];
  return {
    name: 'embroider-builder',
    enforce: 'pre',
    writeBundle(options) {
      engine.activeAddons.forEach(addon => {
        const pkg = resolverLoader.resolver.packageCache.ownerOfFile(addon.root);
        if (!pkg) return;
        const assets = (pkg.meta as AddonMeta)['public-assets'] || {};
        Object.entries(assets).forEach(([path, dest]) => {
          mkdirpSync(dirname(join(options.dir!, dest)));
          copyFileSync(join(pkg.root, path), join(options.dir!, dest));
        });
      });
      copyFileSync(join(options.dir!, 'app', 'index.html'), join(options.dir!, 'index.html'));
      rmSync(join(options.dir!, 'app', 'index.html'));
      rmdirSync(join(options.dir!, 'app'));
    },
    async buildStart() {
      if (!existsSync(embroiderDir)) {
        await emberBuild();
        const files = readdirSync('.');
        const f = lockFiles.find(l => files.includes(l))!;
        updateCacheKey(f, computeCacheKeyForFile(f));
      }
      if (!existsSync(cacheKeyPath)) {
        const files = readdirSync('.');
        const f = lockFiles.find(l => files.includes(l));
        await buildIfFileChanged(f);
      }
      await buildIfFileChanged('app/index.html');
    },
  };
}
