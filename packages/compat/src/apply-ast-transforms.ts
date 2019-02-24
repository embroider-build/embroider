import { readFileSync } from 'fs';
import HTMLBarsTransform, { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import { Tree } from 'broccoli-plugin';
import { join } from 'path';

interface AST {
  _deliberatelyOpaque: 'AST';
}

interface PreprocessOptions {
  contents: string;
  moduleName: string;
  plugins?: {
    [type: string]: unknown[]
  };
}

interface GlimmerSyntax {
  preprocess: (html: string, options?: PreprocessOptions) => AST;
  print: (ast: AST) => string;
  defaultOptions: (options: PreprocessOptions) => PreprocessOptions;
  registerPlugin: (type: string, plugin: unknown) => void;
}

let glimmerSyntaxCache: GlimmerSyntax | undefined;

// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
function loadGlimmerSyntax(templateCompilerPath: string): GlimmerSyntax {
  if (glimmerSyntaxCache) {
    return glimmerSyntaxCache;
  }
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
      glimmerSyntaxCache = {
        print: obj['@glimmer/syntax'].print,
        preprocess: obj['@glimmer/syntax'].preprocess,
        defaultOptions: obj['ember-template-compiler/lib/system/compile-options'].default,
        registerPlugin: obj['ember-template-compiler/lib/system/compile-options'].registerPlugin,

      };
      return glimmerSyntaxCache;
    }
  }
  throw new Error(`unable to find @glimmer/syntax methods in ${templateCompilerPath}`);
}

export default class extends HTMLBarsTransform {
  private syntax: GlimmerSyntax;
  private userPluginsCount: number;

  constructor(inputTree: Tree, options: HTMLBarsOptions) {
    options.name = 'embroider-apply-ast-transforms';
    super(inputTree, options);
    this.syntax = loadGlimmerSyntax(options.templateCompilerPath);

    // unlike our parent class, we don't want to rename hbs to js
    this.targetExtension = null;
    this.userPluginsCount = 0;
    this.embroiderRegisterPlugins(options);
  }

  embroiderRegisterPlugins(options: HTMLBarsOptions) {
    let plugins = options.plugins;
    if (plugins) {
      for (let type in plugins) {
        for (let i = 0, l = plugins[type].length; i < l; i++) {
          this.syntax.registerPlugin(type, plugins[type][i]);
          this.userPluginsCount++;
        }
      }
    }
  }

  processString(source: string, relativePath: string) {
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
  cacheKeyProcessString(source: string, relativePath: string) {
    return `embroider-` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
