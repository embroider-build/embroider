import stripBom from 'strip-bom';
import { Resolver, ResolvedDep } from './resolver';
import { join } from 'path';
import { Memoize } from 'typescript-memoize';
import wrapLegacyHbsPluginIfNeeded from 'wrap-legacy-hbs-plugin-if-needed';

export interface Plugins {
  ast?: unknown[];
}

export interface AST {
  _deliberatelyOpaque: 'AST';
}

export interface PreprocessOptions {
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

export interface PrinterOptions {
  entityEncoding?: 'transformed' | 'raw';
}

// This just reflects the API we're extracting from ember-template-compiler.js,
// plus a cache key that lets us know when the underlying source has remained
// stable.
export interface GlimmerSyntax {
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
}

export interface TemplateCompilerParams {
  // this should be the exports object from ember-template-compiler.js. It's
  // "unknown" here because it changes shape in different ember versions, we
  // will do our best to consume it.
  loadEmberTemplateCompiler: () => { theExports: unknown; cacheKey: string };
  resolver?: Resolver;
  EmberENV: unknown;
  plugins: Plugins;
}

export class TemplateCompiler {
  private loadEmberTemplateCompiler: () => { theExports: unknown; cacheKey: string };
  private resolver?: Resolver;
  private EmberENV: unknown;
  private plugins: Plugins;

  constructor(params: TemplateCompilerParams) {
    this.loadEmberTemplateCompiler = params.loadEmberTemplateCompiler;
    this.resolver = params.resolver;
    this.EmberENV = params.EmberENV;
    this.plugins = params.plugins;
  }

  private get syntax(): GlimmerSyntax {
    return this.setup().syntax;
  }

  get cacheKey(): string {
    return this.setup().cacheKey;
  }

  @Memoize()
  private setup() {
    let { theExports, cacheKey } = this.loadEmberTemplateCompiler();
    let syntax = loadGlimmerSyntax(theExports);
    initializeEmberENV(syntax, this.EmberENV);
    // todo: get resolver reflected in cacheKey
    return { syntax, cacheKey };
  }

  @Memoize()
  private getReversedASTPlugins(ast: unknown[]): unknown[] {
    return ast.slice().reverse();
  }

  // Compiles to the wire format plus dependency list.
  precompile(
    templateSource: string,
    options: Record<string, unknown> & { filename: string }
  ): { compiled: string; dependencies: ResolvedDep[] } {
    let dependencies: ResolvedDep[];
    let runtimeName: string;
    let filename: string = options.filename;

    if (this.resolver) {
      runtimeName = this.resolver.absPathToRuntimePath(filename);
    } else {
      runtimeName = filename;
    }

    let opts = this.syntax.defaultOptions({ contents: templateSource, moduleName: filename });
    let plugins: Plugins = {
      ...opts?.plugins,

      ast: [
        ...this.getReversedASTPlugins(this.plugins.ast!),
        this.resolver && this.resolver.astTransformer(this),

        // Ember 3.27+ uses _buildCompileOptions will not add AST plugins to its result
        ...(opts?.plugins?.ast ?? []),
      ].filter(Boolean),
    };

    let compiled = this.syntax.precompile(stripBom(templateSource), {
      contents: templateSource,
      moduleName: runtimeName,
      plugins,
      ...options,
    });

    if (this.resolver) {
      dependencies = this.resolver.dependenciesOf(filename);
    } else {
      dependencies = [];
    }

    return { compiled, dependencies };
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
    opts.plugins.ast = this.getReversedASTPlugins(this.plugins.ast!).map(plugin => {
      // Although the precompile API does, this direct glimmer syntax api
      // does not support these legacy plugins, so we must wrap them.
      return wrapLegacyHbsPluginIfNeeded(plugin as any);
    });

    // instructs glimmer-vm to preserve entity encodings (e.g. don't parse &nbsp; -> ' ')
    opts.mode = 'codemod';

    opts.filename = moduleName;
    opts.moduleName = this.resolver ? this.resolver.absPathToRuntimePath(moduleName) || moduleName : moduleName;
    let ast = this.syntax.preprocess(contents, opts);

    return this.syntax.print(ast, { entityEncoding: 'raw' });
  }

  parse(moduleName: string, contents: string): AST {
    // this is just a parse, so we deliberately don't run any plugins.
    let opts = { contents, moduleName, plugins: {} };
    return this.syntax.preprocess(contents, opts);
  }

  baseDir() {
    return join(__dirname, '..');
  }
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

// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
function loadGlimmerSyntax(emberTemplateCompilerExports: any): GlimmerSyntax {
  // detect if we are using an Ember version with the exports we need
  // (from https://github.com/emberjs/ember.js/pull/19426)
  if (emberTemplateCompilerExports._preprocess !== undefined) {
    return {
      print: emberTemplateCompilerExports._print,
      preprocess: emberTemplateCompilerExports._preprocess,
      defaultOptions: emberTemplateCompilerExports._buildCompileOptions,
      precompile: emberTemplateCompilerExports.precompile,
      _Ember: emberTemplateCompilerExports._Ember,
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
    let syntax = (emberTemplateCompilerExports.Ember ?? emberTemplateCompilerExports._Ember).__loader.require(
      '@glimmer/syntax'
    );
    let compilerOptions = (emberTemplateCompilerExports.Ember ?? emberTemplateCompilerExports._Ember).__loader.require(
      'ember-template-compiler/lib/system/compile-options'
    );

    return {
      print: syntax.print,
      preprocess: syntax.preprocess,
      defaultOptions: compilerOptions.default,
      precompile: emberTemplateCompilerExports.precompile,
      _Ember: emberTemplateCompilerExports._Ember,
    };
  }
}
