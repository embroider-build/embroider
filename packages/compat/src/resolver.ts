import {
  Resolver,
  TemplateCompiler,
  PackageCache,
  explicitRelative,
  extensionsPattern,
  Package,
} from '@embroider/core';
import {
  ComponentRules,
  PackageRules,
  PreprocessedComponentRule,
  preprocessComponentRule,
  ActivePackageRules,
  ModuleRules,
} from './dependency-rules';
import Options from './options';
import { join, relative, dirname, sep } from 'path';
import { pathExistsSync } from 'fs-extra';
import { dasherize } from './dasherize-component-name';
import { makeResolverTransform } from './resolver-transform';
import { Memoize } from 'typescript-memoize';
import { ResolvedDep } from '@embroider/core/src/resolver';
import { Options as AdjustImportsOptions } from '@embroider/core/src/babel-plugin-adjust-imports';

import resolve from 'resolve';

export interface ComponentResolution {
  type: 'component';
  modules: ResolvedDep[];
  yieldsComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
}

export interface HelperResolution {
  type: 'helper';
  modules: ResolvedDep[];
}

export type ResolutionResult = ComponentResolution | HelperResolution;

export interface ResolutionFail {
  type: 'error';
  message: string;
  detail: string;
  loc: Loc;
}

export type Resolution = ResolutionResult | ResolutionFail;

export interface Loc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// TODO: this depends on the ember version. And it's probably missing some
// private-but-used values.
const builtInHelpers = [
  '-get-dynamic-var',
  '-in-element',
  'in-element',
  '-with-dynamic-vars',
  'action',
  'array',
  'component',
  'concat',
  'debugger',
  'each',
  'each-in',
  'fn',
  'get',
  'has-block',
  'has-block-params',
  'hasBlock',
  'hasBlockParams',
  'hash',
  'if',
  'input',
  'let',
  'link-to',
  'loc',
  'log',
  'mount',
  'mut',
  'on',
  'outlet',
  'partial',
  'query-params',
  'readonly',
  'textarea',
  'unbound',
  'unless',
  'with',
  'yield',
];

const builtInComponents = ['input', 'link-to', 'textarea'];

// this is a subset of the full Options. We care about serializability, and we
// only needs parts that are easily serializable, which is why we don't keep the
// whole thing.
type ResolverOptions = Pick<Required<Options>, 'staticHelpers' | 'staticComponents'>;

function extractOptions(options: Required<Options> | ResolverOptions): ResolverOptions {
  return {
    staticHelpers: options.staticHelpers,
    staticComponents: options.staticComponents,
  };
}

interface RehydrationParams {
  root: string;
  modulePrefix: string;
  podModulePrefix?: string;
  options: ResolverOptions;
  activePackageRules: ActivePackageRules[];
  adjustImportsOptions: AdjustImportsOptions;
}

export function rehydrate(params: RehydrationParams) {
  return new CompatResolver(params);
}

export default class CompatResolver implements Resolver {
  private dependencies: Map<string, Resolution[]> = new Map();
  private templateCompiler: TemplateCompiler | undefined;
  private auditMode = false;

  _parallelBabel: {
    requireFile: string;
    buildUsing: string;
    params: RehydrationParams;
  };

  constructor(private params: RehydrationParams) {
    this.params.options = extractOptions(this.params.options);
    this._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'rehydrate',
      params,
    };
  }

  enter(moduleName: string) {
    let rules = this.findComponentRules(moduleName);
    let deps: Resolution[];
    if (rules?.dependsOnComponents) {
      deps = rules.dependsOnComponents.map(snippet => this.resolveComponentSnippet(snippet, rules!, moduleName));
    } else {
      deps = [];
    }
    this.dependencies.set(moduleName, deps);
  }

  private add(resolution: Resolution, from: string) {
    // this "!" is safe because we always `enter()` a module before hitting this
    this.dependencies.get(from)!.push(resolution);
    return resolution;
  }

  private findComponentRules(absPath: string) {
    return this.rules.components.get(absPath);
  }

  private isIgnoredComponent(dasherizedName: string) {
    return this.rules.ignoredComponents.includes(dasherizedName);
  }

  @Memoize()
  private get rules() {
    if (!this.templateCompiler) {
      throw new Error(
        `Bug: Resolver needs to get linked into a TemplateCompiler before it can understand packageRules`
      );
    }

    // keyed by their first resolved dependency's runtimeName.
    let components: Map<string, PreprocessedComponentRule> = new Map();

    // keyed by our own dasherized interpretation of the component's name.
    let ignoredComponents: string[] = [];

    // we're not responsible for filtering out rules for inactive packages here,
    // that is done before getting to us. So we should assume these are all in
    // force.
    for (let rule of this.params.activePackageRules) {
      if (rule.components) {
        for (let [snippet, componentRules] of Object.entries(rule.components)) {
          if (componentRules.safeToIgnore) {
            ignoredComponents.push(this.standardDasherize(snippet, rule));
            continue;
          }
          let resolvedDep = this.resolveComponentSnippet(snippet, rule).modules[0];
          let processedRules = preprocessComponentRule(componentRules);

          // we always register our rules on the component's own first resolved
          // module, which must be a module in the app's module namespace.
          components.set(resolvedDep.absPath, processedRules);

          // if there's a custom layout, we also need to register our rules on
          // those templates.
          if (componentRules.layout) {
            if (componentRules.layout.appPath) {
              components.set(join(this.params.root, componentRules.layout.appPath), processedRules);
            } else if (componentRules.layout.addonPath) {
              for (let root of rule.roots) {
                components.set(join(root, componentRules.layout.addonPath), processedRules);
              }
            } else {
              throw new Error(
                `layout property in component rule must contain either appPath or addonPath: ${JSON.stringify(
                  rule,
                  null,
                  2
                )}`
              );
            }
          }
        }
      }
      if (rule.appTemplates) {
        for (let [path, templateRules] of Object.entries(rule.appTemplates)) {
          let processedRules = preprocessComponentRule(templateRules);
          components.set(join(this.params.root, path), processedRules);
        }
      }
      if (rule.addonTemplates) {
        for (let [path, templateRules] of Object.entries(rule.addonTemplates)) {
          let processedRules = preprocessComponentRule(templateRules);
          for (let root of rule.roots) {
            components.set(join(root, path), processedRules);
          }
        }
      }
    }
    return { components, ignoredComponents };
  }

  resolveComponentSnippet(
    snippet: string,
    rule: PackageRules | ModuleRules,
    from = 'rule-snippet.hbs'
  ): ResolutionResult & { type: 'component' } {
    if (!this.templateCompiler) {
      throw new Error(`bug: tried to use resolveComponentSnippet without a templateCompiler`);
    }
    let name = this.standardDasherize(snippet, rule);
    let found = this.tryComponent(name, from, false);
    if (found && found.type === 'component') {
      return found;
    }
    throw new Error(`unable to locate component ${snippet} referred to in rule ${JSON.stringify(rule, null, 2)}`);
  }

  private standardDasherize(snippet: string, rule: PackageRules | ModuleRules): string {
    if (!this.templateCompiler) {
      throw new Error(`bug: tried to use resolveComponentSnippet without a templateCompiler`);
    }
    let ast: any;
    try {
      ast = this.templateCompiler.parse('snippet.hbs', snippet);
    } catch (err) {
      throw new Error(`unable to parse component snippet "${snippet}" from rule ${JSON.stringify(rule, null, 2)}`);
    }
    if ((ast.type === 'Program' || ast.type === 'Template') && ast.body.length > 0) {
      let first = ast.body[0];
      const isMustachePath = first.type === 'MustacheStatement' && first.path.type === 'PathExpression';
      const isComponent = isMustachePath && first.path.original === 'component';
      const hasStringParam = isComponent && Array.isArray(first.params) && first.params[0].type === 'StringLiteral';
      if (isMustachePath && isComponent && hasStringParam) {
        return first.params[0].value;
      }
      if (isMustachePath) {
        return first.path.original;
      }
      if (first.type === 'ElementNode') {
        return dasherize(first.tag);
      }
    }
    throw new Error(`cannot identify a component in rule snippet: "${snippet}"`);
  }

  astTransformer(templateCompiler: TemplateCompiler): unknown {
    this.templateCompiler = templateCompiler;
    if (this.staticComponentsEnabled || this.staticHelpersEnabled) {
      return makeResolverTransform(this);
    }
  }

  // called by our audit tool. Forces staticComponents and staticHelpers to
  // activate so we can audit their behavior, while making their errors silent
  // until we can gather them up at the end of the build for the audit results.
  enableAuditMode() {
    this.auditMode = true;
  }

  errorsIn(moduleName: string): ResolutionFail[] {
    let deps = this.dependencies.get(moduleName);
    if (deps) {
      return deps.filter(d => d.type === 'error') as ResolutionFail[];
    } else {
      return [];
    }
  }

  dependenciesOf(moduleName: string): ResolvedDep[] {
    let flatDeps: Map<string, ResolvedDep> = new Map();
    let deps = this.dependencies.get(moduleName);
    if (deps) {
      for (let dep of deps) {
        if (dep.type === 'error') {
          if (!this.auditMode) {
            let e = new Error(
              `${dep.message}: ${dep.detail} in ${humanReadableFile(this.params.root, moduleName)}`
            ) as any;
            e.isTemplateResolverError = true;
            e.loc = dep.loc;
            e.moduleName = moduleName;
            throw e;
          }
        } else {
          for (let entry of dep.modules) {
            let { runtimeName } = entry;
            flatDeps.set(runtimeName, entry);
          }
        }
      }
    }
    return [...flatDeps.values()];
  }

  resolveImport(path: string, from: string): { runtimeName: string; absPath: string } | undefined {
    let absPath;
    try {
      absPath = resolve.sync(path, {
        basedir: dirname(from),
        extensions: this.params.adjustImportsOptions.resolvableExtensions,
      });
    } catch (err) {
      return;
    }
    if (absPath) {
      let runtimeName = this.absPathToRuntimeName(absPath);
      if (runtimeName) {
        return { runtimeName, absPath };
      }
    }
  }

  @Memoize()
  private get resolvableExtensionsPattern() {
    return extensionsPattern(this.params.adjustImportsOptions.resolvableExtensions);
  }

  absPathToRuntimePath(absPath: string, owningPackage?: { root: string; name: string }) {
    let pkg = owningPackage || PackageCache.shared('embroider-stage3').ownerOfFile(absPath);
    if (pkg) {
      let packageRuntimeName = pkg.name;
      for (let [runtimeName, realName] of Object.entries(this.params.adjustImportsOptions.renamePackages)) {
        if (realName === packageRuntimeName) {
          packageRuntimeName = runtimeName;
          break;
        }
      }
      return join(packageRuntimeName, relative(pkg.root, absPath)).split(sep).join('/');
    } else if (absPath.startsWith(this.params.root)) {
      return join(this.params.modulePrefix, relative(this.params.root, absPath)).split(sep).join('/');
    } else {
      throw new Error(`bug: can't figure out the runtime name for ${absPath}`);
    }
  }

  absPathToRuntimeName(absPath: string, owningPackage?: { root: string; name: string }) {
    return this.absPathToRuntimePath(absPath, owningPackage)
      .replace(this.resolvableExtensionsPattern, '')
      .replace(/\/index$/, '');
  }

  private get staticComponentsEnabled(): boolean {
    return this.params.options.staticComponents || this.auditMode;
  }

  private get staticHelpersEnabled(): boolean {
    return this.params.options.staticHelpers || this.auditMode;
  }

  private tryHelper(path: string, from: string): Resolution | null {
    for (let extension of this.params.adjustImportsOptions.resolvableExtensions) {
      let absPath = join(this.params.root, 'helpers', path) + extension;
      if (pathExistsSync(absPath)) {
        return {
          type: 'helper',
          modules: [
            {
              runtimeName: `${this.params.modulePrefix}/helpers/${path}`,
              path: explicitRelative(dirname(from), absPath),
              absPath,
            },
          ],
        };
      }
    }
    return null;
  }

  @Memoize()
  private get appPackage(): AppPackagePlaceholder {
    return { root: this.params.root, name: this.params.modulePrefix };
  }

  private tryComponent(path: string, from: string, withRuleLookup = true): Resolution | null {
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      let cache = PackageCache.shared('embroider-stage3');
      let packageName = parts[0];
      let renamed = this.params.adjustImportsOptions.renamePackages[packageName];
      if (renamed) {
        packageName = renamed;
      }
      return this._tryComponent(parts[1], from, withRuleLookup, cache.resolve(packageName, cache.ownerOfFile(from)!));
    } else {
      return this._tryComponent(path, from, withRuleLookup, this.appPackage);
    }
  }

  private _tryComponent(
    path: string,
    from: string,
    withRuleLookup: boolean,
    targetPackage: Package | AppPackagePlaceholder
  ): Resolution | null {
    // The order here is important! We always put our .hbs paths first here, so
    // that if we have an hbs file of our own, that will be the first resolved
    // dependency. The first resolved dependency is special because we use that
    // as a key into the rules, and we want to be able to find our rules when
    // checking from our own template (among other times).

    let extensions = ['.hbs', ...this.params.adjustImportsOptions.resolvableExtensions.filter(e => e !== '.hbs')];

    let componentModules = [] as string[];

    // first, the various places our template might be
    for (let extension of extensions) {
      let absPath = join(targetPackage.root, 'templates', 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push(absPath);
        break;
      }

      absPath = join(targetPackage.root, 'components', path, 'template') + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push(absPath);
        break;
      }

      if (
        typeof this.params.podModulePrefix !== 'undefined' &&
        this.params.podModulePrefix !== '' &&
        targetPackage === this.appPackage
      ) {
        let podPrefix = this.params.podModulePrefix.replace(this.params.modulePrefix, '');

        absPath = join(targetPackage.root, podPrefix, 'components', path, 'template') + extension;
        if (pathExistsSync(absPath)) {
          componentModules.push(absPath);
          break;
        }
      }
    }

    // then the various places our javascript might be
    for (let extension of extensions) {
      if (extension === '.hbs') {
        continue;
      }

      let absPath = join(targetPackage.root, 'components', path, 'index') + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push(absPath);
        break;
      }

      absPath = join(targetPackage.root, 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push(absPath);
        break;
      }

      absPath = join(targetPackage.root, 'components', path, 'component') + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push(absPath);
        break;
      }

      if (
        typeof this.params.podModulePrefix !== 'undefined' &&
        this.params.podModulePrefix !== '' &&
        targetPackage === this.appPackage
      ) {
        let podPrefix = this.params.podModulePrefix.replace(this.params.modulePrefix, '');

        absPath = join(targetPackage.root, podPrefix, 'components', path, 'component') + extension;
        if (pathExistsSync(absPath)) {
          componentModules.push(absPath);
          break;
        }
      }
    }

    if (componentModules.length > 0) {
      let componentRules;
      if (withRuleLookup) {
        componentRules = this.findComponentRules(componentModules[0]);
      }
      return {
        type: 'component',
        modules: componentModules.map(absPath => ({
          path: explicitRelative(dirname(from), absPath),
          absPath,
          runtimeName: this.absPathToRuntimeName(absPath, targetPackage),
        })),
        yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
        yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
        argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      };
    }

    return null;
  }

  resolveSubExpression(path: string, from: string, loc: Loc): Resolution | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }
    let found = this.tryHelper(path, from);
    if (found) {
      return this.add(found, from);
    }
    if (builtInHelpers.includes(path)) {
      return null;
    }
    return this.add(
      {
        type: 'error',
        message: `Missing helper`,
        detail: path,
        loc,
      },
      from
    );
  }

  resolveMustache(path: string, hasArgs: boolean, from: string, loc: Loc): Resolution | null {
    if (this.staticHelpersEnabled) {
      let found = this.tryHelper(path, from);
      if (found) {
        return this.add(found, from);
      }
    }
    if (this.staticComponentsEnabled) {
      let found = this.tryComponent(path, from);
      if (found) {
        return this.add(found, from);
      }
    }
    if (
      hasArgs &&
      this.staticComponentsEnabled &&
      this.staticHelpersEnabled &&
      !builtInHelpers.includes(path) &&
      !this.isIgnoredComponent(path)
    ) {
      return this.add(
        {
          type: 'error',
          message: `Missing component or helper`,
          detail: path,
          loc,
        },
        from
      );
    } else {
      return null;
    }
  }

  resolveElement(tagName: string, from: string, loc: Loc): Resolution | null {
    if (!this.staticComponentsEnabled) {
      return null;
    }

    if (tagName[0] === tagName[0].toLowerCase()) {
      // starts with lower case, so this can't be a component we need to
      // globally resolve
      return null;
    }

    let dName = dasherize(tagName);

    if (builtInComponents.includes(dName)) {
      return null;
    }

    let found = this.tryComponent(dName, from);
    if (found) {
      return this.add(found, from);
    }

    if (this.isIgnoredComponent(dName)) {
      return null;
    }

    return this.add(
      {
        type: 'error',
        message: `Missing component`,
        detail: tagName,
        loc,
      },
      from
    );
  }

  resolveComponentHelper(
    component: ComponentLocator,
    from: string,
    loc: Loc,
    impliedBecause?: { componentName: string; argumentName: string }
  ): Resolution | null {
    if (!this.staticComponentsEnabled) {
      return null;
    }

    let message;
    if (impliedBecause) {
      message = `argument "${impliedBecause.argumentName}" to component "${impliedBecause.componentName}" is treated as a component, but the value you're passing is dynamic`;
    } else {
      message = `Unsafe dynamic component`;
    }

    if (component.type === 'other') {
      return this.add(
        {
          type: 'error',
          message,
          detail: `cannot statically analyze this expression`,
          loc,
        },
        from
      );
    }
    if (component.type === 'path') {
      let ownComponentRules = this.findComponentRules(from);
      if (ownComponentRules && ownComponentRules.safeInteriorPaths.includes(component.path)) {
        return null;
      }
      return this.add(
        {
          type: 'error',
          message,
          detail: component.path,
          loc,
        },
        from
      );
    }
    let found = this.tryComponent(component.path, from);
    if (found) {
      return this.add(found, from);
    }
    return this.add(
      {
        type: 'error',
        message: `Missing component`,
        detail: component.path,
        loc,
      },
      from
    );
  }
}

function humanReadableFile(root: string, file: string) {
  if (!root.endsWith('/')) {
    root += '/';
  }
  if (file.startsWith(root)) {
    return file.slice(root.length);
  }
  return file;
}

// we don't have a real Package for the app itself because the resolver has work
// to do before we have even written out the app's own package.json and
// therefore made it into a fully functional Package.
interface AppPackagePlaceholder {
  root: string;
  name: string;
}

export type ComponentLocator =
  | {
      type: 'literal';
      path: string;
    }
  | {
      type: 'path';
      path: string;
    }
  | {
      type: 'other';
    };
