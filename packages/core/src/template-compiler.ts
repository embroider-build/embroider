import stripBom from 'strip-bom';
import { Resolution, Resolver, ResolverParams } from './resolver';
import { warn } from './messages';
import { readFileSync } from 'fs';
import { makeResolverTransform } from './resolver-transform';

export interface Plugins {
  ast?: unknown[];
}

// this is the ember template compiler's external interface (though it's
// internal to this module).
interface Compiler {
  precompile(templateContents: string, options: any): string;
  registerPlugin(type: string, plugin: unknown): void;
  _Ember: any;
}

// we don't want to share one instance, so we can't use "require".
function loadEmberCompiler(absoluteCompilerPath: string) {
  let source = readFileSync(absoluteCompilerPath, 'utf8');
  let module = {
    exports: {}
  };
  eval(source);
  return module.exports as Compiler;
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
export default function setupCompiler(params: SetupCompilerParams) {
  let compiler = loadEmberCompiler(params.compilerPath);
  let ResolverClass: Resolver = require(params.resolverPath).default;
  let resolver = new ResolverClass(params.resolverParams);
  let dependencies:  Map<string, Resolution[]> = new Map();

  registerPlugins(compiler, params.plugins);
  compiler.registerPlugin('ast', makeResolverTransform(resolver, dependencies));
  initializeEmberENV(compiler, params.EmberENV);

  function dependenciesOf(moduleName: string): Resolution[] | undefined {
    return dependencies.get(moduleName);
  }

  function compile(moduleName: string, contents: string) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    let lines: string[] = [];
    let deps = dependenciesOf(moduleName);
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
  return { compile, dependenciesOf };
}

function registerPlugins(compiler: Compiler, plugins: Plugins) {
  if (plugins.ast) {
    for (let i = 0, l = plugins.ast.length; i < l; i++) {
      compiler.registerPlugin('ast', plugins.ast[i]);
    }
  }
}

function initializeEmberENV(templateCompiler: Compiler, EmberENV: any) {
  if (!templateCompiler || !EmberENV) { return; }

  let props;

  if (EmberENV.FEATURES) {
    props = Object.keys(EmberENV.FEATURES);

    props.forEach(prop => {
      templateCompiler._Ember.FEATURES[prop] = EmberENV.FEATURES[prop];
    });
  }

  if (EmberENV) {
    props = Object.keys(EmberENV);

    props.forEach(prop => {
      if (prop === 'FEATURES') { return; }

      templateCompiler._Ember.ENV[prop] = EmberENV[prop];
    });
  }
}
