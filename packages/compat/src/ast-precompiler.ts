import { readFileSync } from 'fs';
import HTMLBarsTransform, { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import { Tree } from 'broccoli-plugin';
import { join } from 'path';
import { PluginItem } from '@babel/core';

interface AST {
  _deliberatelyOpaque: 'AST';
}

interface PreprocessOptions {
  contents: string;
  moduleName: string;
  plugins?: {
    ast?: unknown[]
  };
}

interface GlimmerSyntax {
  preprocess: (html: string, options?: PreprocessOptions) => AST;
  print: (ast: AST) => string;
  defaultOptions: (options: PreprocessOptions) => PreprocessOptions;
  registerPlugin: (type: string, plugin: unknown) => void;
}

// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
function loadGlimmerSyntax(templateCompilerPath: string): GlimmerSyntax {
  let orig = Object.create;
  let grabbed: any[] = [];
  (Object as any).create = function(proto: any, propertiesObject: any) {
    let result = orig.call(this, proto, propertiesObject);
    grabbed.push(result);
    return result;
  };
  try {
    eval(readFileSync(templateCompilerPath, 'utf8'));
  } finally {
    Object.create = orig;
  }
  for (let obj of grabbed) {
    if (obj['@glimmer/syntax'] && obj['@glimmer/syntax'].print) {
      // we found the loaded modules
      return {
        print: obj['@glimmer/syntax'].print,
        preprocess: obj['@glimmer/syntax'].preprocess,
        defaultOptions: obj['ember-template-compiler/lib/system/compile-options'].default,
        registerPlugin: obj['ember-template-compiler/lib/system/compile-options'].registerPlugin,

      };
    }
  }
  throw new Error(`unable to find @glimmer/syntax methods in ${templateCompilerPath}`);
}

export default class ASTPrecompiler {
  private syntax: GlimmerSyntax;
  private userPluginsCount: number;

  constructor(readonly options: HTMLBarsOptions) {
    let syntax = loadGlimmerSyntax(options.templateCompilerPath);
    let userPluginsCount = 0;
    let plugins = options.plugins;
    if (plugins && plugins.ast) {
      for (let i = 0, l = plugins.ast.length; i < l; i++) {
        syntax.registerPlugin('ast', plugins.ast[i]);
        userPluginsCount++;
      }
    }
    this.syntax = syntax;
    this.userPluginsCount = userPluginsCount;
    this.precompile = this.precompile.bind(this);
    (this.precompile as any).baseDir = () => join(__dirname, '..');
  }

  precompile(source: string, relativePath: string) {
    let opts = this.syntax.defaultOptions({
      contents: source,
      moduleName: relativePath
    });
    if (opts.plugins && opts.plugins.ast) {
      // the user-provided plugins come first in the list, and those are the
      // only ones we want to run. The built-in plugins don't need to run here
      // in stage1, it's better that they run in stage3 when the appropriate
      // ember version is in charge.
      //
      // rather than slicing them off, we could choose instead to not call
      // syntax.defaultOptions, but then we lose some of the compatibility
      // normalization that it does on the user-provided plugins.
      opts.plugins.ast = opts.plugins.ast.slice(0, this.userPluginsCount);
    }
    let ast = this.syntax.preprocess(source, opts);
    return this.syntax.print(ast);
  }

  transform(tree: Tree): Tree {
    return new ApplyASTTransforms(tree, this);
  }

  inlineBabelPlugin(): PluginItem {
    // TODO: add parallelBabel protocol
    return [join(__dirname, 'inline-apply-ast-transforms.js'), { precompile: this.precompile }];
  }
}

class ApplyASTTransforms extends HTMLBarsTransform {
  private precompiler: ASTPrecompiler;
  constructor(inputTree: Tree, precompiler: ASTPrecompiler) {
    precompiler.options.name = 'embroider-apply-ast-transforms';
    super(inputTree, precompiler.options);

    // unlike our parent class, we don't want to rename hbs to js
    this.targetExtension = null;
    this.precompiler = precompiler;
  }

  processString(source: string, relativePath: string) {
    return this.precompiler.precompile(source, relativePath);
  }
  cacheKeyProcessString(source: string, relativePath: string) {
    return `embroider-` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
