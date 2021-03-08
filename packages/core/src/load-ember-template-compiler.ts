import fs, { readFileSync, statSync } from 'fs';
import { createContext, Script } from 'vm';
import { createHash } from 'crypto';
import { GlimmerSyntax } from './ember-template-compiler-types';
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

function getEmberExports(templateCompilerPath: string): EmbersExports {
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
  let theExports: any = context.module.exports;

  // cacheKey, theExports
  let cacheKey = createHash('md5').update(source).digest('hex');

  entry = Object.freeze({
    value: {
      cacheKey,
      theExports,
    },
    stat, // This is stored, so we can reload the templateCompiler if it changes mid-build.
  });

  CACHE.set(templateCompilerPath, entry);
  return entry.value;
}

// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
export function loadGlimmerSyntax(templateCompilerPath: string): GlimmerSyntax {
  let { theExports, cacheKey } = getEmberExports(templateCompilerPath);

  // detect if we are using an Ember version with the exports we need
  // (from https://github.com/emberjs/ember.js/pull/19426)
  if (theExports._preprocess !== undefined) {
    return {
      print: theExports._print,
      preprocess: theExports._preprocess,
      defaultOptions: theExports._buildCompileOptions,
      precompile: theExports.precompile,
      _Ember: theExports._Ember,
      cacheKey,
    };
  } else {
    // Older Ember versions (prior to 3.27) do not expose a public way to to source 2 source compilation of templates.
    // because of this, we must resort to some hackery.
    //
    // We use the following API's (that we grab from Ember.__loader):
    //
    // * glimmer/syntax's preprocess
    // * glimmer/syntax's print
    // * ember-template-compiler/lib/system/compile-options's defaultOptions
    let syntax = theExports.Ember.__loader.require('@glimmer/syntax');
    let compilerOptions = theExports.Ember.__loader.require('ember-template-compiler/lib/system/compile-options');

    return {
      print: syntax.print,
      preprocess: syntax.preprocess,
      defaultOptions: compilerOptions.default,
      precompile: theExports.precompile,
      _Ember: theExports._Ember,
      cacheKey,
    };
  }
}
