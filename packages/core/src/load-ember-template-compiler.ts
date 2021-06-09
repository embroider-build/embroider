import fs, { readFileSync, statSync } from 'fs';
import { createContext, Script } from 'vm';
import { createHash } from 'crypto';
import { patch } from './patch-template-compiler';

type TemplateCompilerCacheEntry = {
  value: EmbersExports;
  stat: fs.Stats;
};

type EmbersExports = {
  cacheKey: string;
  theExports: any;
};

const CACHE = new Map<string, TemplateCompilerCacheEntry>();

export function getEmberExports(templateCompilerPath: string): EmbersExports {
  let entry = CACHE.get(templateCompilerPath);

  if (entry) {
    let currentStat = statSync(templateCompilerPath);

    // Let's ensure the template is still what we cached
    if (
      currentStat.mode === entry.stat.mode &&
      currentStat.size === entry.stat.size &&
      currentStat.mtime.getTime() === entry.stat.mtime.getTime()
    ) {
      return entry.value;
    }
  }

  let stat = statSync(templateCompilerPath);

  let source = patch(readFileSync(templateCompilerPath, 'utf8'), templateCompilerPath);
  let theExports: any = undefined;

  // cacheKey, theExports
  let cacheKey = createHash('md5').update(source).digest('hex');

  entry = Object.freeze({
    value: {
      cacheKey,
      get theExports() {
        if (theExports) {
          return theExports;
        }

        // matches (essentially) what ember-cli-htmlbars does in https://git.io/Jtbpj
        let sandbox = {
          module: { require, exports: {} },
          require,
        };

        if (typeof globalThis === 'undefined') {
          // for Node 10 usage with Ember 3.27+ we have to define the `global` global
          // in order for ember-template-compiler.js to evaluate properly
          // due to this code https://git.io/Jtb7
          (sandbox as any).global = sandbox;
        }
        // using vm.createContext / vm.Script to ensure we evaluate in a fresh sandbox context
        // so that any global mutation done within ember-template-compiler.js does not leak out
        let context = createContext(sandbox);
        let script = new Script(source, { filename: templateCompilerPath });

        script.runInContext(context);
        return (theExports = context.module.exports);
      },
    },
    stat, // This is stored, so we can reload the templateCompiler if it changes mid-build.
  });

  CACHE.set(templateCompilerPath, entry);
  return entry.value;
}
