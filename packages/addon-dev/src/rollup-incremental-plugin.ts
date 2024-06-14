import walkSync from 'walk-sync';
import { rmSync } from 'fs';
import { join } from 'path';
import type { OutputAsset, Plugin } from 'rollup';
import { existsSync } from 'fs-extra';

export default function incremental(): Plugin {
  const changed = new Set();
  const generatedAssets = new Map();
  const generatedFiles = new Set<string>();

  function isEqual(v1: string | Uint8Array, v2: string | Uint8Array): boolean {
    if (typeof v1 === 'string' && typeof v2 === 'string') {
      return v1 === v2;
    }
    if (Buffer.isBuffer(v1) && Buffer.isBuffer(v2)) {
      return v1.equals(v2);
    }
    return false;
  }

  let firstTime = true;

  function initGeneratedFiles(outDir: string) {
    if (existsSync(outDir)) {
      const files = walkSync(outDir, {
        globs: ['*/**'],
        directories: false,
      });
      for (const file of files) {
        generatedFiles.add(file);
      }
    }
  }

  function deleteRemovedFiles(bundle: Record<string, any>, outDir: string) {
    for (const file of generatedFiles) {
      if (!bundle[file]) {
        generatedAssets.delete(file);
        rmSync(join(outDir, file));
      }
    }
    generatedFiles.clear();
    for (const file of Object.keys(bundle)) {
      generatedFiles.add(file);
    }
  }

  function syncFiles(bundle: Record<string, any>) {
    for (const key of Object.keys(bundle)) {
      let checkKey = key;
      if (key.endsWith('.js.map')) {
        checkKey = key.replace('.js.map', '.js');
        if (!bundle[checkKey]) {
          delete bundle[key];
          continue;
        }
      }
      if (bundle[checkKey]?.type === 'asset') {
        if (
          generatedAssets.has(checkKey) &&
          isEqual(
            (bundle[checkKey] as OutputAsset).source,
            generatedAssets.get(checkKey)
          )
        ) {
          delete bundle[key];
          continue;
        } else {
          generatedAssets.set(
            checkKey,
            (bundle[checkKey] as OutputAsset).source
          );
        }
      }
      if (
        (bundle[checkKey] as any)?.moduleIds?.every(
          (m: string) => !changed.has(m)
        )
      ) {
        delete bundle[key];
      }
    }
    changed.clear();
  }

  return {
    name: 'clean',
    transform(_code, id) {
      changed.add(id);
    },
    generateBundle(options, bundle) {
      if (firstTime) {
        firstTime = false;
        initGeneratedFiles(options.dir!);
      }
      if (existsSync(options.dir!)) {
        deleteRemovedFiles(bundle, options.dir!);
      }

      syncFiles(bundle);
    },
  };
}
