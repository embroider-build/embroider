import stripBom from 'strip-bom';
import { Resolution, Resolver, ResolverParams } from './resolver';
import { warn } from './messages';
import { readFileSync } from 'fs';
import { makeResolverTransform } from './resolver-transform';

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
}

interface GlimmerSyntax {
  preprocess(html: string, options?: PreprocessOptions): AST;
  print(ast: AST): string;
  defaultOptions(options: PreprocessOptions): PreprocessOptions;
  registerPlugin(type: string, plugin: unknown): void;
  precompile(templateContents: string, options: { contents: string, moduleName: string }): string;
  _Ember: { FEATURES: any, ENV: any };
}

// we could directly depend on @glimmer/syntax and have nice types and
// everything. But the problem is, we really want to use the exact version that
// the app itself is using, and its copy is bundled away inside
// ember-template-compiler.js.
function loadGlimmerSyntax(templateCompilerPath: string): GlimmerSyntax {
  let orig = Object.create;
  let grabbed: any[] = [];

  // we need this in scope here so our eval below will use it (instead of our
  // own module scoped one)
  let module = { exports: {} };

  (Object as any).create = function(proto: any, propertiesObject: any) {
    let result = orig.call(this, proto, propertiesObject);
    grabbed.push(result);
    return result;
  };
  try {
    // eval evades the require cache, which we need because the template
    // compiler shares internal module scoped state.
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
        precompile: (module.exports as any).precompile,
        _Ember: (module.exports as any)._Ember,
      };
    }
  }
  throw new Error(`unable to find @glimmer/syntax methods in ${templateCompilerPath}`);
}

export interface SetupCompilerParams {
  compilerPath: string;
  resolverPath: string;
  resolverParams: ResolverParams;
  EmberENV: unknown;
  plugins: Plugins;
}

// The signature of this function may feel a little weird, but that's because
// it's designed to be easy to invoke via our portable plugin config in a new
// process.
export default class TemplateCompiler {
  private dependencies:  Map<string, Resolution[]> = new Map();
  private syntax: GlimmerSyntax;

  constructor(params: SetupCompilerParams) {
    this.syntax = loadGlimmerSyntax(params.compilerPath);
    this.registerPlugins(params.plugins);
    let ResolverClass: Resolver = require(params.resolverPath).default;
    let resolver = new ResolverClass(params.resolverParams);
    this.syntax.registerPlugin('ast', makeResolverTransform(resolver, this.dependencies));
    this.initializeEmberENV(params.EmberENV);
  }

  // This is only public to make testing easier. During normal usage it's not
  // called from outside.
  dependenciesOf(moduleName: string): Resolution[] | undefined {
    return this.dependencies.get(moduleName);
  }

  compile(moduleName: string, contents: string) {
    let compiled = this.syntax.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    let lines: string[] = [];
    let deps = this.dependenciesOf(moduleName);
    if (deps) {
      let counter = 0;
      for (let dep of deps) {
        if (dep.type === 'error') {
          if (dep.hardFail) {
            throw new Error(dep.message);
          } else {
            warn(dep.message);
          }
        } else {
          for (let { runtimeName, path } of dep.modules) {
            lines.push(`import a${counter} from "${path}";`);
            lines.push(`window.define('${runtimeName}', function(){ return a${counter++}});`);
          }
        }
      }
    }
    lines.push(`export default Ember.HTMLBars.template(${compiled});`);
    return lines.join("\n");
  }

  private registerPlugins(plugins: Plugins) {
    if (plugins.ast) {
      for (let i = 0, l = plugins.ast.length; i < l; i++) {
        this.syntax.registerPlugin('ast', plugins.ast[i]);
      }
    }
  }

  private initializeEmberENV(EmberENV: any) {
    if (!EmberENV) { return; }

    let props;

    if (EmberENV.FEATURES) {
      props = Object.keys(EmberENV.FEATURES);
      props.forEach(prop => {
        this.syntax._Ember.FEATURES[prop] = EmberENV.FEATURES[prop];
      });
    }

    if (EmberENV) {
      props = Object.keys(EmberENV);
      props.forEach(prop => {
        if (prop === 'FEATURES') { return; }
        this.syntax._Ember.ENV[prop] = EmberENV[prop];
      });
    }
  }
}
