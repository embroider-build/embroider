import stripBom from 'strip-bom';
import { Resolver, ResolvedDep } from './resolver';
import fs, { readFileSync, statSync } from 'fs';
import { Node } from 'broccoli-node-api';
import Filter from 'broccoli-persistent-filter';
import stringify from 'json-stable-stringify';
import { createHash } from 'crypto';
import { join, resolve, sep } from 'path';
import { PluginItem, transform } from '@babel/core';
import { Memoize } from 'typescript-memoize';
import wrapLegacyHbsPluginIfNeeded from 'wrap-legacy-hbs-plugin-if-needed';
import { patch } from './patch-template-compiler';
import { Portable, PortableHint } from './portable';
import type { Params as InlineBabelParams } from './babel-plugin-inline-hbs';
import { createContext, Script } from 'vm';
import adjustImportsPlugin from './babel-plugin-adjust-imports';

export interface Plugins {
  ast?: unknown[];
}

interface AST {
  _deliberatelyOpaque: 'AST';
}

interface PreprocessOptions {
  contents: string;
  moduleName: string;
  plugins?: Plugins;
  filename?: string;

  parseOptions?: {
    srcName?: string;
    ignoreStandalone?: boolean;
  };

  // added in Ember 3.17 (@glimmer/syntax@0.40.2)
  mode?: 'codemod' | 'precompile';

  // added in Ember 3.25
  strictMode?: boolean;
  locals?: string[];
}

interface PrinterOptions {
  entityEncoding?: 'transformed' | 'raw';
}

// This just reflects the API we're extracting from ember-template-compiler.js,
// plus a cache key that lets us know when the underlying source has remained
// stable.
interface GlimmerSyntax {
  preprocess(html: string, options?: PreprocessOptions): AST;
  print(ast: AST, options?: PrinterOptions): string;
  defaultOptions(options: PreprocessOptions): PreprocessOptions;
  precompile(
    templateContents: string,
    options: {
      contents: string;
      moduleName: string;
      filename: string;
      plugins?: any;
      parseOptions?: {
        srcName?: string;
      };
    }
  ): string;
  _Ember: { FEATURES: any; ENV: any };
  cacheKey: string;
}

// Here we cache the templateCompiler, as we tend to reuse the same template
// compiler throughout the build.
//
type EmbersExports = {
  cacheKey: string;
  theExports: any;
};

type TemplateCompilerCacheEntry = {
  value: EmbersExports;
  stat: fs.Stats;
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
    // due to this code https://git.io/Jtb7s
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
function loadGlimmerSyntax(templateCompilerPath: string): GlimmerSyntax {
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

export function templateCompilerModule(params: TemplateCompilerParams, hints: PortableHint[]) {
  let p = new Portable({ hints });
  let result = p.dehydrate(params);
  return {
    src: [
      `const { TemplateCompiler } = require("${__filename}");`,
      `const { Portable } = require("${resolve(__dirname, './portable.js')}");`,
      `let p = new Portable({ hints: ${JSON.stringify(hints, null, 2)} });`,
      `module.exports = new TemplateCompiler(p.hydrate(${JSON.stringify(result.value, null, 2)}))`,
    ].join('\n'),
    isParallelSafe: result.isParallelSafe,
  };
}

export interface TemplateCompilerParams {
  compilerPath: string;
  resolver?: Resolver;
  EmberENV: unknown;
  plugins: Plugins;
}

export class TemplateCompiler {
  constructor(public params: TemplateCompilerParams) {
    // stage3 packagers don't need to know about our instance, they can just
    // grab the compile function and use it.
    this.compile = this.compile.bind(this);
  }

  private get syntax(): GlimmerSyntax {
    return this.setup().syntax;
  }

  get cacheKey(): string {
    return this.setup().cacheKey;
  }

  @Memoize()
  private setup() {
    let syntax = loadGlimmerSyntax(this.params.compilerPath);
    initializeEmberENV(syntax, this.params.EmberENV);
    let cacheKey = createHash('md5')
      .update(
        stringify({
          // todo: get resolver reflected in cacheKey
          syntax: syntax.cacheKey,
        })
      )
      .digest('hex');
    return { syntax, cacheKey };
  }

  @Memoize()
  private getReversedASTPlugins(ast: unknown[]): unknown[] {
    return ast.slice().reverse();
  }

  // Compiles to the wire format plus dependency list.
  precompile(moduleName: string, contents: string): { compiled: string; dependencies: ResolvedDep[] } {
    let dependencies: ResolvedDep[];
    let runtimeName: string;

    if (this.params.resolver) {
      runtimeName = this.params.resolver.absPathToRuntimePath(moduleName);
    } else {
      runtimeName = moduleName;
    }

    let opts = this.syntax.defaultOptions({ contents, moduleName });
    let plugins: Plugins = {
      ...opts?.plugins,

      ast: [
        ...this.getReversedASTPlugins(this.params.plugins.ast!),
        this.params.resolver && this.params.resolver.astTransformer(this),

        // Ember 3.27+ uses _buildCompileOptions will not add AST plugins to its result
        ...(opts?.plugins?.ast ?? []),
      ].filter(Boolean),
    };

    let compiled = this.syntax.precompile(stripBom(contents), {
      contents,
      moduleName: runtimeName,
      filename: moduleName,
      plugins,
    });

    if (this.params.resolver) {
      dependencies = this.params.resolver.dependenciesOf(moduleName);
    } else {
      dependencies = [];
    }

    return { compiled, dependencies };
  }

  // Compiles all the way from a template string to a javascript module string.
  compile(moduleName: string, contents: string) {
    let { compiled, dependencies } = this.precompile(moduleName, contents);
    let lines = [];
    let counter = 0;
    for (let { runtimeName, path } of dependencies) {
      lines.push(`import a${counter} from "${path.split(sep).join('/')}";`);
      lines.push(`window.define('${runtimeName}', function(){ return a${counter++}});`);
    }

    lines.push(`import { createTemplateFactory } from '@ember/template-factory';`);
    lines.push(`export default createTemplateFactory(${compiled});`);

    let src = lines.join('\n');
    let resolver = this.params.resolver;
    if (resolver) {
      return transform(src, {
        filename: moduleName,
        generatorOpts: {
          compact: false,
        },
        plugins: [[adjustImportsPlugin, resolver.adjustImportsOptions]],
      })!.code!;
    } else {
      return src;
    }
  }

  // Applies all custom AST transforms and emits the results still as
  // handlebars.
  applyTransforms(moduleName: string, contents: string): string {
    let opts = this.syntax.defaultOptions({ contents, moduleName });

    // the user-provided plugins come first in the list, and those are the
    // only ones we want to run. The built-in plugins don't need to run here
    // in stage1, it's better that they run in stage3 when the appropriate
    // ember version is in charge.
    //
    // rather than slicing them off, we could choose instead to not call
    // syntax.defaultOptions, but then we lose some of the compatibility
    // normalization that it does on the user-provided plugins.
    opts.plugins = opts.plugins || {}; // Ember 3.27+ won't add opts.plugins
    opts.plugins.ast = this.getReversedASTPlugins(this.params.plugins.ast!).map(plugin => {
      // Although the precompile API does, this direct glimmer syntax api
      // does not support these legacy plugins, so we must wrap them.
      return wrapLegacyHbsPluginIfNeeded(plugin as any);
    });

    // instructs glimmer-vm to preserve entity encodings (e.g. don't parse &nbsp; -> ' ')
    opts.mode = 'codemod';

    opts.filename = moduleName;
    opts.moduleName = this.params.resolver
      ? this.params.resolver.absPathToRuntimePath(moduleName) || moduleName
      : moduleName;
    let ast = this.syntax.preprocess(contents, opts);

    return this.syntax.print(ast, { entityEncoding: 'raw' });
  }

  parse(moduleName: string, contents: string): AST {
    // this is just a parse, so we deliberately don't run any plugins.
    let opts = { contents, moduleName, plugins: {} };
    return this.syntax.preprocess(contents, opts);
  }

  // Use applyTransforms on every file in a broccoli tree.
  applyTransformsToTree(tree: Node): Node {
    return new TemplateCompileTree(tree, this, 1);
  }

  // Use applyTransforms on the contents of inline hbs template strings inside
  // Javascript.
  inlineTransformsBabelPlugin(): PluginItem {
    return [
      join(__dirname, 'babel-plugin-inline-hbs.js'),
      {
        templateCompiler: Object.assign({ cacheKey: this.cacheKey, baseDir: this.baseDir }, this.params),
        stage: 1,
      } as InlineBabelParams,
    ];
  }

  baseDir() {
    return join(__dirname, '..');
  }

  // tests for the classic ember-cli-htmlbars-inline-precompile babel plugin
  static isInlinePrecompilePlugin(item: PluginItem) {
    if (typeof item === 'string') {
      return matchesSourceFile(item);
    }
    if (hasProperties(item) && (item as any)._parallelBabel) {
      return matchesSourceFile((item as any)._parallelBabel.requireFile);
    }
    if (Array.isArray(item) && item.length > 0) {
      if (typeof item[0] === 'string') {
        return matchesSourceFile(item[0]);
      }
      if (hasProperties(item[0]) && (item[0] as any)._parallelBabel) {
        return matchesSourceFile((item[0] as any)._parallelBabel.requireFile);
      }
    }
    return false;
  }
}

class TemplateCompileTree extends Filter {
  constructor(inputTree: Node, private templateCompiler: TemplateCompiler, private stage: 1 | 3) {
    super(inputTree, {
      name: `embroider-template-compile-stage${stage}`,
      persist: true,
      extensions: ['hbs', 'handlebars'],
      // in stage3 we are changing the file extensions from hbs to js. In
      // stage1, we are just keeping hbs.
      targetExtension: stage === 3 ? 'js' : undefined,
    });
  }

  processString(source: string, relativePath: string) {
    if (this.stage === 1) {
      return this.templateCompiler.applyTransforms(relativePath, source);
    } else {
      return this.templateCompiler.compile(relativePath, source);
    }
  }
  cacheKeyProcessString(source: string, relativePath: string) {
    return `${this.stage}-${this.templateCompiler.cacheKey}` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}

function matchesSourceFile(filename: string) {
  return /(htmlbars-inline-precompile|ember-cli-htmlbars)\/(index|lib\/require-from-worker)(\.js)?$/.test(filename);
}

function hasProperties(item: any) {
  return item && (typeof item === 'object' || typeof item === 'function');
}

// this matches the setup done by ember-cli-htmlbars: https://git.io/JtbN6
function initializeEmberENV(syntax: GlimmerSyntax, EmberENV: any) {
  if (!EmberENV) {
    return;
  }

  let props;

  if (EmberENV.FEATURES) {
    props = Object.keys(EmberENV.FEATURES);
    props.forEach(prop => {
      syntax._Ember.FEATURES[prop] = EmberENV.FEATURES[prop];
    });
  }

  if (EmberENV) {
    props = Object.keys(EmberENV);
    props.forEach(prop => {
      if (prop === 'FEATURES') {
        return;
      }
      syntax._Ember.ENV[prop] = EmberENV[prop];
    });
  }
}
