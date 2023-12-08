import { join } from 'path/posix';
import { createHash } from 'crypto';
import { fork } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import type { Plugin } from 'vite';

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

export async function buildIfFileChanged(path: string | null | undefined): Promise<boolean> {
  if (path && lockFiles.includes(path)) {
    const key = computeCacheKeyForFile(path);
    if (key !== getCacheKey(path)) {
      console.log(path + ' change requires rebuild, rebuilding...');
      await emberBuild();
      updateCacheKey(path, key);
      return true;
    }
  }
  return false;
}

export function build(): Plugin {
  return {
    name: 'embroider-builder',
    enforce: 'pre',
    configureServer(server) {
      const files = readdirSync('.');
      files.forEach(f => {
        if (lockFiles.includes(f)) {
          server.watcher.add('./' + f);
        }
      });
      server.watcher.on('change', async path => {
        const needRestart = await buildIfFileChanged(path);
        if (needRestart) {
          server.restart(true);
        }
      });
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
