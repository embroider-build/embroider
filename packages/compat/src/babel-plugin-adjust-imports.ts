import { join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { readJSONSync } from 'fs-extra';
import { CompatResolverOptions } from './resolver-transform';
import { Resolver } from '@embroider/core';
import { snippetToDasherizedName } from './dasherize-component-name';
import { ModuleRules, TemplateRules } from './dependency-rules';

export type Options = { appRoot: string };

interface State {
  opts: Options;
}

type BabelTypes = typeof t;
type InternalConfig = {
  resolverOptions: CompatResolverOptions;
  resolver: Resolver;
  extraImports: {
    [absPath: string]: {
      dependsOnComponents?: string[]; // these are already standardized in dasherized form
      dependsOnModules?: string[];
    };
  };
};

export default function main(babel: typeof Babel) {
  let t = babel.types;
  let cached: InternalConfig | undefined;
  function getConfig(appRoot: string) {
    if (cached) {
      return cached;
    }
    let resolverOptions: CompatResolverOptions = readJSONSync(join(appRoot, '.embroider', 'resolver.json'));
    cached = {
      resolverOptions,
      resolver: new Resolver(resolverOptions),
      extraImports: preprocessExtraImports(resolverOptions),
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
  let entry = config.extraImports[filename];
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
  let value = t.callExpression(adder.import(path, '@embroider/macros', 'importSync'), [t.stringLiteral(target)]);
  return t.expressionStatement(
    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
      t.stringLiteral(runtimeName),
      t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ])
  );
}

function preprocessExtraImports(config: CompatResolverOptions): InternalConfig['extraImports'] {
  let extraImports: InternalConfig['extraImports'] = {};
  for (let rule of config.activePackageRules) {
    if (rule.addonModules) {
      for (let [filename, moduleRules] of Object.entries(rule.addonModules)) {
        for (let root of rule.roots) {
          expandDependsOnRules(root, filename, moduleRules, extraImports);
        }
      }
    }
    if (rule.appModules) {
      for (let [filename, moduleRules] of Object.entries(rule.appModules)) {
        expandDependsOnRules(config.appRoot, filename, moduleRules, extraImports);
      }
    }
    if (rule.addonTemplates) {
      for (let [filename, moduleRules] of Object.entries(rule.addonTemplates)) {
        for (let root of rule.roots) {
          expandInvokesRules(root, filename, moduleRules, extraImports);
        }
      }
    }
    if (rule.appTemplates) {
      for (let [filename, moduleRules] of Object.entries(rule.appTemplates)) {
        expandInvokesRules(config.appRoot, filename, moduleRules, extraImports);
      }
    }
  }
  return extraImports;
}

function expandDependsOnRules(
  root: string,
  filename: string,
  rules: ModuleRules,
  extraImports: InternalConfig['extraImports']
) {
  if (rules.dependsOnModules || rules.dependsOnComponents) {
    let entry: InternalConfig['extraImports'][string] = {};
    if (rules.dependsOnModules) {
      entry.dependsOnModules = rules.dependsOnModules;
    }
    if (rules.dependsOnComponents) {
      entry.dependsOnComponents = rules.dependsOnComponents.map(c => {
        let d = snippetToDasherizedName(c);
        if (!d) {
          throw new Error(`unable to parse component snippet "${c}" from rule ${JSON.stringify(rules, null, 2)}`);
        }
        return d;
      });
    }
    extraImports[join(root, filename)] = entry;
  }
}

function expandInvokesRules(
  root: string,
  filename: string,
  rules: TemplateRules,
  extraImports: InternalConfig['extraImports']
) {
  if (rules.invokes) {
    let dependsOnComponents: string[] = [];
    for (let componentList of Object.values(rules.invokes)) {
      for (let component of componentList) {
        let d = snippetToDasherizedName(component);
        if (!d) {
          throw new Error(
            `unable to parse component snippet "${component}" from rule ${JSON.stringify(rules, null, 2)}`
          );
        }
        dependsOnComponents.push(d);
      }
    }
    extraImports[join(root, filename)] = { dependsOnComponents };
  }
}
