import { join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import { readJSONSync } from 'fs-extra';
import { CompatResolverOptions } from './resolver-transform';
import { Resolver } from '@embroider/core';
import { snippetToDasherizedName } from './dasherize-component-name';
import { ActivePackageRules, ComponentRules, ModuleRules, TemplateRules } from './dependency-rules';

export type Options = { appRoot: string };

interface State {
  opts: Options;
}

type BabelTypes = typeof t;

interface ExtraImports {
  [key: string]: {
    dependsOnComponents?: string[]; // these are already standardized in dasherized form
    dependsOnModules?: string[];
  };
}

type InternalConfig = {
  resolverOptions: CompatResolverOptions;
  resolver: Resolver;

  // rule-based extra dependencies, indexed by filename
  extraImports: ExtraImports;

  // rule-based extra dependencies, indexed by classical component name
  componentExtraImports: ExtraImports;
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
      componentExtraImports: preprocessComponentExtraImports(resolverOptions),
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
  let adder = new ImportUtil(t, path);
  if (entry) {
    applyRules(t, path, entry, adder, config, filename);
  }

  let componentName = config.resolver.reverseComponentLookup(filename);
  if (componentName) {
    let rules = config.componentExtraImports[componentName];
    if (rules) {
      applyRules(t, path, rules, adder, config, filename);
    }
  }
}

function applyRules(
  t: BabelTypes,
  path: NodePath<t.Program>,
  rules: ExtraImports[string],
  adder: ImportUtil,
  config: InternalConfig,
  filename: string
) {
  if (rules.dependsOnModules) {
    for (let target of rules.dependsOnModules) {
      path.node.body.unshift(amdDefine(t, adder, path, target, target));
    }
  }
  if (rules.dependsOnComponents) {
    for (let dasherizedName of rules.dependsOnComponents) {
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

function amdDefine(t: BabelTypes, adder: ImportUtil, path: NodePath<t.Program>, target: string, runtimeName: string) {
  let value = t.callExpression(adder.import(path, '@embroider/macros', 'importSync'), [t.stringLiteral(target)]);
  return t.expressionStatement(
    t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
      t.stringLiteral(runtimeName),
      t.functionExpression(null, [], t.blockStatement([t.returnStatement(value)])),
    ])
  );
}

function preprocessExtraImports(config: CompatResolverOptions): ExtraImports {
  let extraImports: ExtraImports = {};
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

function preprocessComponentExtraImports(config: CompatResolverOptions): ExtraImports {
  let extraImports: ExtraImports = {};
  for (let rule of config.activePackageRules) {
    if (rule.components) {
      for (let [componentName, rules] of Object.entries(rule.components)) {
        if (rules.invokes) {
          extraImports[dasherizeComponent(componentName, rule)] = {
            dependsOnComponents: Object.values(rules.invokes)
              .flat()
              .map(c => dasherizeComponent(c, rules)),
          };
        }
      }
    }
  }
  return extraImports;
}

function dasherizeComponent(
  componentSnippet: string,
  rules: ModuleRules | ComponentRules | ActivePackageRules
): string {
  let d = snippetToDasherizedName(componentSnippet);
  if (!d) {
    throw new Error(
      `unable to parse component snippet "${componentSnippet}" from rule ${JSON.stringify(rules, null, 2)}`
    );
  }
  return d;
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
      entry.dependsOnComponents = rules.dependsOnComponents.map(c => dasherizeComponent(c, rules));
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
