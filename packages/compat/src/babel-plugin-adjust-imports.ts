import { join } from 'path';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { ImportUtil } from 'babel-import-util';
import type { CompatResolverOptions } from './resolver-transform';
import type { Package } from '@embroider/core';
import { cleanUrl, packageName, type Resolver, ResolverLoader, unrelativize } from '@embroider/core';
import { snippetToDasherizedName } from './dasherize-component-name';
import type { ActivePackageRules, ComponentRules, ModuleRules, TemplateRules } from './dependency-rules';
import { appTreeRulesDir } from './dependency-rules';

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
  loader: ResolverLoader;

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
    let loader = new ResolverLoader(appRoot);

    cached = {
      loader,
      extraImports: preprocessExtraImports(loader),
      componentExtraImports: preprocessComponentExtraImports(loader),
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
  let filename: string = cleanUrl((path.hub as any).file.opts.filename);
  let entry = config.extraImports[filename];
  let adder = new ImportUtil(t, path);
  if (entry) {
    applyRules(t, path, entry, adder, config, filename);
  }

  let componentName = config.loader.resolver.reverseComponentLookup(filename);
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
  let lookup = lazyPackageLookup(config, filename);
  if (rules.dependsOnModules) {
    for (let target of rules.dependsOnModules) {
      if (lookup.owningPackage) {
        let runtimeName: string;
        if (packageName(target)) {
          runtimeName = target;
        } else {
          runtimeName = unrelativize(lookup.owningPackage, target, filename);
        }
        path.node.body.unshift(amdDefine(t, adder, path, target, runtimeName));
      }
    }
  }
  if (rules.dependsOnComponents) {
    for (let dasherizedName of rules.dependsOnComponents) {
      if (lookup.owningEngine) {
        path.node.body.unshift(
          amdDefine(
            t,
            adder,
            path,
            `@embroider/virtual/components/${dasherizedName}`,
            `${lookup.owningEngine.packageName}/components/${dasherizedName}`
          )
        );
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

function preprocessExtraImports(loader: ResolverLoader): ExtraImports {
  let extraImports: ExtraImports = {};
  let config = loader.resolver.options as CompatResolverOptions;
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
        for (let root of rule.roots) {
          // in general v2 addons can keep their app tree stuff in other places
          // than "_app_" and we would need to check their package.json to see.
          // But this code is only for applying packageRules to auto-upgraded v1
          // addons, and those we always organize with their treeForApp output
          // in _app_.
          expandDependsOnRules(appTreeRulesDir(root, loader.resolver), filename, moduleRules, extraImports);
        }
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
        for (let root of rule.roots) {
          expandInvokesRules(appTreeRulesDir(root, loader.resolver), filename, moduleRules, extraImports);
        }
      }
    }
  }
  return extraImports;
}

function lazyPackageLookup(config: InternalConfig, filename: string) {
  let owningPackage: { result: Package | undefined } | undefined;
  let owningEngine: { result: ReturnType<Resolver['owningEngine']> | undefined } | undefined;
  return {
    get owningPackage() {
      if (!owningPackage) {
        owningPackage = { result: config.loader.resolver.packageCache.ownerOfFile(filename) };
      }
      return owningPackage.result;
    },
    get owningEngine() {
      if (!owningEngine) {
        owningEngine = { result: undefined };
        let p = this.owningPackage;
        if (p) {
          owningEngine.result = config.loader.resolver.owningEngine(p);
        }
      }
      return owningEngine.result;
    },
  };
}

function preprocessComponentExtraImports(loader: ResolverLoader): ExtraImports {
  let extraImports: ExtraImports = {};
  let config = loader.resolver.options as CompatResolverOptions;
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
