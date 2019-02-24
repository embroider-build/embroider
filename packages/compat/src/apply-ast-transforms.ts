import { readFileSync } from 'fs';
import HTMLBarsTransform, { Options as HTMLBarsOptions } from 'ember-cli-htmlbars';
import { Tree } from 'broccoli-plugin';
import { join } from 'path';

interface AST {
  _deliberatelyOpaque: 'AST';
}

// see processString in ember-cli-htmlbars/index.js. We are going to build almost exactly the same transform, but instead of templateCompiler.precomiple we call ssyntax.print(yntax.preprocess())
interface PreprocessOptions {
  contents: string;   // the original source of the template
  moduleName: string; // example: "ember-basic-dropdown/templates/components/basic-dropdown-content.hbs"
}

interface GlimmerSyntax {
  preprocess: (html: string, options?: PreprocessOptions) => AST;
  print: (ast: AST) => string;
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
      };
      return glimmerSyntaxCache;
    }
  }
  throw new Error(`unable to find @glimmer/syntax methods in ${templateCompilerPath}`);
}

export default class extends HTMLBarsTransform {
  private syntax: GlimmerSyntax;

  constructor(inputTree: Tree, options: HTMLBarsOptions) {
    options.name = 'embroider-apply-ast-transforms';
    super(inputTree, options);
    this.syntax = loadGlimmerSyntax(options.templateCompilerPath);

    // unlike our parent class, we don't want to rename hbs to js
    this.targetExtension = null;
  }
  processString(source: string, relativePath: string) {
    console.log(`we are processing ${relativePath}`);
    let ast = this.syntax.preprocess(source, {
      contents: source,
      moduleName: relativePath
    });
    return this.syntax.print(ast);
  }
  cacheKeyProcessString(source: string, relativePath: string) {
    return `embroider-` + super.cacheKeyProcessString(source, relativePath);
  }
  baseDir() {
    return join(__dirname, '..');
  }
}
