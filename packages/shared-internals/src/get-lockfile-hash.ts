import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Returns the hash of the lockfile.
 * Useful for cache keys.
 */

/**
 * https://github.com/vitejs/vite/blob/29cdb390374689e4dec9017b21fefe88b6ce4203/packages/vite/src/node/optimizer/index.ts#L1207
 */
const lockfileFormats = [
  {
    path: 'node_modules/.package-lock.json',
    checkPatchesDir: 'patches',
    manager: 'npm',
  },
  {
    // Yarn non-PnP
    path: 'node_modules/.yarn-state.yml',
    checkPatchesDir: false,
    manager: 'yarn',
  },
  {
    // Yarn v3+ PnP
    path: '.pnp.cjs',
    checkPatchesDir: '.yarn/patches',
    manager: 'yarn',
  },
  {
    // Yarn v2 PnP
    path: '.pnp.js',
    checkPatchesDir: '.yarn/patches',
    manager: 'yarn',
  },
  {
    // yarn 1
    path: 'node_modules/.yarn-integrity',
    checkPatchesDir: 'patches',
    manager: 'yarn',
  },
  {
    path: 'node_modules/.pnpm/lock.yaml',
    // Included in lockfile
    checkPatchesDir: false,
    manager: 'pnpm',
  },
  {
    path: '.rush/temp/shrinkwrap-deps.json',
    // Included in lockfile
    checkPatchesDir: false,
    manager: 'pnpm',
  },
  {
    path: 'bun.lock',
    checkPatchesDir: 'patches',
    manager: 'bun',
  },
  {
    path: 'bun.lockb',
    checkPatchesDir: 'patches',
    manager: 'bun',
  },
].sort((_, { manager }) => {
  return process.env.npm_config_user_agent?.startsWith(manager) ? 1 : -1;
});
const lockfilePaths = lockfileFormats.map(l => l.path);

/**
 * https://github.com/vitejs/vite/blob/29cdb390374689e4dec9017b21fefe88b6ce4203/packages/vite/src/node/utils.ts#L410
 */
function lookupFile(dir: string, fileNames: string[]): string | undefined {
  while (dir) {
    for (const fileName of fileNames) {
      const fullPath = path.join(dir, fileName);
      if (tryStatSync(fullPath)?.isFile()) return fullPath;
    }
    const parentDir = path.dirname(dir);
    if (parentDir === dir) return;

    dir = parentDir;
  }
}

function tryStatSync(file: string): fs.Stats | undefined {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    return fs.statSync(file, { throwIfNoEntry: false });
  } catch {
    // Ignore errors
  }
}

/**
 * https://github.com/vitejs/vite/blob/29cdb390374689e4dec9017b21fefe88b6ce4203/packages/vite/src/node/utils.ts#L1122
 */
export function getHash(text: Buffer | string, length = 8): string {
  const h = crypto.hash('sha256', text, 'hex').substring(0, length);
  if (length <= 64) return h;
  return h.padEnd(length, '_');
}

/**
 * Used subset of:
 * https://github.com/vitejs/vite/blob/29cdb390374689e4dec9017b21fefe88b6ce4203/packages/vite/src/node/environment.ts#L7
 */
interface ViteEnvironment {
  config: {
    root: string;
  };
}

/**
 * NOTE: shared-internals' node support doesn't include replaceAll
 */
function replaceBackslashesWithForwardSlash(str: string) {
  return str.replace(new RegExp('\\\\', 'g'), '/');
}

export function getLockfileHash(environment: ViteEnvironment): string {
  const lockfilePath = lookupFile(environment.config.root, lockfilePaths);
  let content = lockfilePath ? fs.readFileSync(lockfilePath, 'utf-8') : '';

  if (lockfilePath) {
    const normalizedLockfilePath = replaceBackslashesWithForwardSlash(lockfilePath);
    const lockfileFormat = lockfileFormats.find(f => normalizedLockfilePath.endsWith(f.path))!;
    if (lockfileFormat.checkPatchesDir) {
      // Default of https://github.com/ds300/patch-package
      const baseDir = lockfilePath.slice(0, -lockfileFormat.path.length);
      const fullPath = path.join(baseDir, lockfileFormat.checkPatchesDir as string);
      const stat = tryStatSync(fullPath);
      if (stat?.isDirectory()) {
        content += stat.mtimeMs.toString();
      }
    }
  }
  return getHash(content);
}
