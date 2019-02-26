import stripBom from 'strip-bom';
import { ResolverInstance, Resolution } from './resolver';
import { warn } from './messages';

export interface Plugins {
  [type: string]: unknown[];
}

export interface Compiler {
  precompile(templateContents: string, options: any): string;
  registerPlugin(type: string, plugin: unknown): void;
  _Ember: any;
}

function inScope(scopeStack: string[][], name: string) {
  for (let scope of scopeStack) {
    if (scope.includes(name)) {
      return true;
    }
  }
  return false;
}

function handleComponentHelper(param: any, resolver: ResolverInstance, moduleName: string, deps: Resolution[]) {
  let resolution;
  if (param.type === 'StringLiteral') {
    resolution = resolver.resolveComponentHelper(param.value, true, moduleName);
  } else {
    resolution = resolver.resolveComponentHelper(param.original, false, moduleName);
  }
  if (resolution) {
    deps.push(resolution);
  }
}

function makeResolverTransform(resolver: ResolverInstance, dependencies: Map<string, Resolution[]>) {
  return function resolverTransform(env: { moduleName: string }) {
    let deps: Resolution[] = [];
    dependencies.set(env.moduleName, deps);

    let scopeStack: string[][] = [];

    return {
      name: 'embroider-build-time-resolver',

      visitor: {
        Program: {
          enter(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.push(node.blockParams);
            }
          },
          exit(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.pop();
            }
          }
        },
        BlockStatement(node: any) {
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        SubExpression(node: any) {
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          let resolution = resolver.resolveSubExpression(node.path.original, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        MustacheStatement(node: any) {
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        ElementNode: {
          enter(node: any) {
            if (!inScope(scopeStack, node.tag.split('.')[0])) {
              let resolution = resolver.resolveElement(node.tag, env.moduleName);
              if (resolution) {
                deps.push(resolution);
              }
            }
            if (node.blockParams.length > 0) {
              scopeStack.push(node.blockParams);
            }
          },
          exit(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.pop();
            }
          }
        }
      }
    };
  };
}

export default function setupCompiler(compiler: Compiler, resolver: ResolverInstance, EmberENV: unknown, plugins: Plugins) {
  let dependencies:  Map<string, Resolution[]> = new Map();

  registerPlugins(compiler, plugins);
  compiler.registerPlugin('ast', makeResolverTransform(resolver, dependencies));
  initializeEmberENV(compiler, EmberENV);

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
