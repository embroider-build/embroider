import { fork } from 'child_process';
import { existsSync, statSync, readFileSync, writeFileSync } from 'fs';
import type { Plugin } from 'vite';
import { join } from 'path';
import { readdirSync } from 'fs-extra';
import type { ResolvedConfig } from 'vite';

const cwd = process.cwd();
const embroiderDir = join(cwd, 'node_modules', '.embroider');
const cacheKeyPath = join(embroiderDir, 'cache-key.json');
const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];

function getCacheKey(file: string) {
  if (existsSync(cacheKeyPath)) {
    return JSON.parse(readFileSync(cacheKeyPath).toString())[file];
  }
  return null;
}

function updateCacheKey(file: string) {
  let json: Record<string, string | null> = {};
  if (existsSync(cacheKeyPath)) {
    json = JSON.parse(readFileSync(cacheKeyPath).toString());
  }
  json[file] = statSync(file).mtimeMs.toString();
  writeFileSync(cacheKeyPath, JSON.stringify(json));
}

function computeCacheKeyForFile(file: string) {
  if (existsSync(file)) {
    return statSync(file).mtimeMs.toString();
  }
  return null;
}

export function emberBuild(mode: string, depsChanged: boolean): Promise<void> {
  if (mode === 'build') {
    return new Promise((resolve, reject) => {
      const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--production'], { silent: true });
      child.on('exit', code => (code === 0 ? resolve() : reject()));
    });
  }
  return new Promise((resolve, reject) => {
    const env = {
      SKIP_COMPAT_ADDONS: (!depsChanged).toString(),
    };
    const child = fork('./node_modules/ember-cli/bin/ember', ['build', '--watch'], { silent: true, env });
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error('ember build --watch failed'))));
    child.on('spawn', () => {
      child.stderr?.on('data', data => {
        console.error(data.toString());
      });
      child.stdout!.on('data', data => {
        console.log(data.toString());
        if (data.toString().includes('Build successful')) {
          resolve();
        }
      });
    });
  });
}

export async function didDepChange(): Promise<string | null> {
  const files = readdirSync('.');
  for (const path of files) {
    if (path && lockFiles.includes(path)) {
      const key = computeCacheKeyForFile(path);
      if (key !== getCacheKey(path)) {
        return path;
      }
    }
  }
  return null;
}

export function compatPrebuild(): Plugin {
  let mode = 'build';
  let config: ResolvedConfig | undefined;
  return {
    name: 'embroider-builder',
    enforce: 'pre',
    configureServer(server) {
      config = server.config;
      mode = 'development';
    },
    async buildStart() {
      const depChanged = config?.optimizeDeps.force || (await didDepChange());
      if (depChanged) {
        console.log('prebuild ember with compat addons');
      }
      await emberBuild(mode, !!depChanged);
      if (typeof depChanged === 'string') {
        updateCacheKey(depChanged);
      }
    },
  };
}
