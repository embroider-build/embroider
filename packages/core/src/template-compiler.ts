import stripBom from 'strip-bom';
import { ResolverInstance, Resolution } from './resolver';

export interface Plugins {
  [type: string]: unknown[];
}

export interface Compiler {
  precompile(templateContents: string, options: any): string;
  registerPlugin(type: string, plugin: unknown): void;
  _Ember: any;
}

const dependencies: Map<string, Set<Resolution>> = new Map();

function makeResolverTransform(resolver: ResolverInstance) {
  return function resolverTransform(env: { moduleName: string }) {
    let deps: Set<Resolution> = new Set();
    dependencies.set(env.moduleName, deps);
    return {
      name: 'embroider-build-time-resolver',
      visitor: {
        SubExpression(node: any) {
          let resolution = resolver.resolveSubExpression(node.path.original, env.moduleName);
          if (resolution) {
            deps.add(resolution);
          }
        },
        MustacheStatement(node: any) {
          let resolution = resolver.resolveMustache(node.path.original, env.moduleName);
          if (resolution) {
            deps.add(resolution);
          }
        },
        ElementNode(node: any) {
          let resolution = resolver.resolveElement(node.tag, env.moduleName);
          if (resolution) {
            deps.add(resolution);
          }
        },
      }
    };
  };
}

export default function(compiler: Compiler, resolver: ResolverInstance, EmberENV: unknown, plugins: Plugins) {
  registerPlugins(compiler, plugins);
  compiler.registerPlugin('ast', makeResolverTransform(resolver));
  initializeEmberENV(compiler, EmberENV);
  return function(moduleName: string, contents: string) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    let lines: string[] = [];
    let deps = dependencies.get(moduleName);
    if (deps) {
      let counter = 0;
      for (let dep of deps) {
        for (let { runtimeName, path } of dep.modules) {
          lines.push(`import a${counter} from "${path}";`);
          lines.push(`window.define('${runtimeName}', function(){ return a${counter++}});`);
        }
      }
    }
    lines.push(`export default Ember.HTMLBars.template(${compiled});`);
    return lines.join("\n");
  };
}

function registerPlugins(compiler: Compiler, plugins: Plugins) {
  for (let type in plugins) {
    for (let i = 0, l = plugins[type].length; i < l; i++) {
      compiler.registerPlugin(type, plugins[type][i]);
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
