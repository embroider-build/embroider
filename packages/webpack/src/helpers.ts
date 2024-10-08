import assert from 'assert';
import type { UnpluginOptions } from 'unplugin';

/**
 * I used to use \0 for the prefix, but when explicitly
 * using the prefix in our own virtual modules (importing other virtual modules),
 * we get an error:
 *   Module not found:
 *     TypeError [ERR_INVALID_ARG_VALUE]:
 *       The argument 'path' must be a string, Uint8Array, or URL without null bytes.
 *       Received '<consuming-project-path>/node_modules/\x00kolay/package.json'
 *
 * I had also tried using `virtual:` for a prefix, but webpack doesn't allow that
 *   Webpack supports "data:" and "file:" URIs by default
 *   You may need an additional plugin to handle "virtual:" URIs.
 */
export const INTERNAL_PREFIX = `\0`;

interface VirtualFileOptions {
  importPath: string;
  content: string | (() => string);
}

/**
 * Create a virtual file in a rollup-based API by only specifying the desired import path and the content of the virtual file.
 */
export function virtualFile(options: VirtualFileOptions | VirtualFileOptions[]): Omit<UnpluginOptions, 'name'> {
  const opts = Array.isArray(options) ? options : [options];

  opts.forEach((opt, i) => {
    assert(opt.importPath, `Must pass \`importPath\` to virtualFile:${i}`);
    assert(opt.content, `Must pass \`content\` to virtualFile:${i}`);
  });

  const imports = opts.map(opt => opt.importPath);
  const allowed = new Set(imports);

  return {
    resolveId(id) {
      if (allowed.has(id)) {
        return {
          id: `${INTERNAL_PREFIX}${id}`,
        };
      }

      return;
    },
    loadInclude(id) {
      if (!id.startsWith(INTERNAL_PREFIX)) return false;

      return allowed.has(id.slice(1));
    },
    load(id) {
      if (!id.startsWith(INTERNAL_PREFIX)) return;

      let importPath = id.slice(1);

      if (!allowed.has(importPath)) return;

      let opt = opts.find(opt => opt.importPath === importPath);

      assert(opt, `Could not find content for ${opt?.importPath}`);

      if (typeof opt.content === 'string') return opt.content;

      return opt.content();
    },
  };
}
