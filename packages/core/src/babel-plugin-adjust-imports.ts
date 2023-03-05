import { join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { readJSONSync } from 'fs-extra';
import { Resolver, Options as ModuleResolverOptions } from './module-resolver';

export type Options = { appRoot: string };

interface State {
  opts: Options;
}

type BabelTypes = typeof t;
type InternalConfig = {
  resolverOptions: ModuleResolverOptions;
  resolver: Resolver;
};

export default function main(babel: typeof Babel) {
  let t = babel.types;
  let cached: InternalConfig | undefined;
  function getConfig(appRoot: string) {
    if (cached) {
      return cached;
    }
    let resolverOptions: ModuleResolverOptions = readJSONSync(join(appRoot, '.embroider', 'resolver.json'));
    cached = {
      resolverOptions,
      resolver: new Resolver(resolverOptions),
    };
    return cached;
  }

  return {
    visitor: {
      Program: {
        enter(path: NodePath<t.Program>, state: State) {
          addExtraImports(t, path, getConfig(state.opts.appRoot));
        },
      },
    },
  };
}

(main as any).baseDir = function () {
  return join(__dirname, '..');
};

function addExtraImports(t: BabelTypes, path: NodePath<t.Program>, config: InternalConfig) {
  let filename: string = path.hub.file.opts.filename;
  let entry = config.resolverOptions.extraImports[filename];
  if (entry) {
    let adder = new ImportUtil(t, path);
    if (entry.dependsOnModules) {
      for (let target of entry.dependsOnModules) {
        path.node.body.unshift(amdDefine(t, adder, path, target, target));
      }
    }
    if (entry.dependsOnComponents) {
      for (let dasherizedName of entry.dependsOnComponents) {
        let pkg = config.resolver.owningPackage(filename);
        if (pkg) {
          let owningEngine = config.resolver.owningEngine(pkg);
          if (owningEngine) {
            path.node.body.unshift(
              amdDefine(
                t,
                adder,
                path,
                `#embroider_compat/components/${dasherizedName}`,
                `${owningEngine.packageName}/components/${dasherizedName}`
              )
            );
          }
        }
      }
    }
  }

  //let componentName = config.resolver.reverseComponentLookup(filename);
}

function amdDefine(t: BabelTypes, adder: ImportUtil, path: NodePath<t.Program>, target: string, runtimeName: string) {
  let value = adder.import(path, target, 'default');
  return t.expressionStatement(
    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
      t.stringLiteral(runtimeName),
      t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ])
  );
}
