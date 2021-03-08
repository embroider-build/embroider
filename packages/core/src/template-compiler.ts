import stripBom from 'strip-bom';
import { Resolver, ResolvedDep } from './resolver';
import stringify from 'json-stable-stringify';
import { createHash } from 'crypto';
import { join, resolve, sep } from 'path';
import type { PluginItem } from '@babel/core';
import { Memoize } from 'typescript-memoize';
import wrapLegacyHbsPluginIfNeeded from 'wrap-legacy-hbs-plugin-if-needed';
import { Portable, PortableHint } from './portable';
import type { Params as InlineBabelParams } from './babel-plugin-inline-hbs';
import { Plugins, GlimmerSyntax, AST } from './ember-template-compiler-types';
import { loadGlimmerSyntax } from './load-ember-template-compiler';

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
    lines.push(`export default Ember.HTMLBars.template(${compiled});`);
    return lines.join('\n');
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
