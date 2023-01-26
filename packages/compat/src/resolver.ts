import {
  ActivePackageRules,
  ComponentRules,
  ModuleRules,
  PackageRules,
  PreprocessedComponentRule,
  preprocessComponentRule,
} from './dependency-rules';
import {
  Package,
  PackageCache,
  explicitRelative,
  extensionsPattern,
  ResolverOptions as CoreResolverOptions,
} from '@embroider/core';
import { dirname, join, relative, sep } from 'path';

import { Memoize } from 'typescript-memoize';
import Options from './options';
import { dasherize, snippetToDasherizedName } from './dasherize-component-name';
import { pathExistsSync } from 'fs-extra';
import resolve from 'resolve';
import semver from 'semver';
import { Options as ResolverTransformOptions } from './resolver-transform';

export interface ResolvedDep {
  runtimeName: string;
  path: string;
  absPath: string;
}

export interface ComponentResolution {
  type: 'component';
  jsModule: ResolvedDep | null;
  hbsModule: ResolvedDep | null;
  yieldsComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
  nameHint: string;
}

export interface HelperResolution {
  type: 'helper';
  module: ResolvedDep;
  nameHint: string;
}

export interface ModifierResolution {
  type: 'modifier';
  module: ResolvedDep;
  nameHint: string;
}

export type ResolutionResult = ComponentResolution | HelperResolution | ModifierResolution;

export interface ResolutionFail {
  type: 'error';
  message: string;
  detail: string;
  loc: Loc;
}

interface ResolverDependencyError extends Error {
  isTemplateResolverError?: boolean;
  loc?: Loc;
  moduleName?: string;
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
  'helper',
  'if',
  'input',
  'let',
  'link-to',
  'loc',
  'log',
  'modifier',
  'mount',
  'mut',
  'on',
  'outlet',
  'partial',
  'query-params',
  'readonly',
  'textarea',
  'unbound',
  'unique-id',
  'unless',
  'with',
  'yield',
];

const builtInComponents = ['input', 'link-to', 'textarea'];
const builtInModifiers = ['action', 'on'];

// this is a subset of the full Options. We care about serializability, and we
// only needs parts that are easily serializable, which is why we don't keep the
// whole thing.
type ResolverOptions = Pick<
  Required<Options>,
  'staticHelpers' | 'staticModifiers' | 'staticComponents' | 'allowUnsafeDynamicComponents'
>;

function extractOptions(options: Required<Options> | ResolverOptions): ResolverOptions {
  return {
    staticHelpers: options.staticHelpers,
    staticModifiers: options.staticModifiers,
    staticComponents: options.staticComponents,
    allowUnsafeDynamicComponents: options.allowUnsafeDynamicComponents,
  };
}

interface RehydrationParamsBase {
  root: string;
  modulePrefix: string;
  podModulePrefix?: string;
  options: ResolverOptions;
  emberVersion: string;
  activePackageRules: ActivePackageRules[];
}

interface RehydrationParamsWithFile extends RehydrationParamsBase {
  adjustImportsOptionsPath: string;
}

interface RehydrationParamsWithOptions extends RehydrationParamsBase {
  adjustImportsOptions: CoreResolverOptions;
}

type RehydrationParams = RehydrationParamsWithFile | RehydrationParamsWithOptions;

export function rehydrate(params: RehydrationParams) {
  return new CompatResolver(params);
}

export interface AuditMessage {
  message: string;
  detail: string;
  loc: Loc;
  source: string;
  filename: string;
}

export default class CompatResolver {
  private auditHandler: undefined | ((msg: AuditMessage) => void);

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
    if ((globalThis as any).embroider_audit) {
      this.auditHandler = (globalThis as any).embroider_audit;
    }
  }

  private findComponentRules(absPath: string): PreprocessedComponentRule | undefined {
    let rules = this.rules.components.get(absPath);
    if (rules) {
      return rules;
    }

    // co-located templates aren't visible to the resolver, because they never
    // get resolved from a template (they are always handled directly by the
    // corresponding JS module, which the resolver *does* see). This means their
    // paths won't ever be in `this.rules.components`. But we do want them to
    // "inherit" the rules that are attached to their corresonding JS module.
    if (absPath.endsWith('.hbs')) {
      let stem = absPath.slice(0, -4);
      for (let ext of this.adjustImportsOptions.resolvableExtensions) {
        if (ext !== '.hbs') {
          let rules = this.rules.components.get(stem + ext);
          if (rules) {
            return rules;
          }
        }
      }
    }
    return undefined;
  }

  private isIgnoredComponent(dasherizedName: string) {
    return this.rules.ignoredComponents.includes(dasherizedName);
  }

  @Memoize()
  get adjustImportsOptions(): CoreResolverOptions {
    const { params } = this;
    return 'adjustImportsOptionsPath' in params
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        require(params.adjustImportsOptionsPath)
      : params.adjustImportsOptions;
  }

  @Memoize()
  private get rules() {
    // keyed by their first resolved dependency's absPath.
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
          let resolvedSnippet = this.resolveComponentSnippet(snippet, rule);

          // cast is OK here because a component must have one or the other
          let resolvedDep = (resolvedSnippet.hbsModule ?? resolvedSnippet.jsModule)!;

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
  ): ComponentResolution {
    let name = this.standardDasherize(snippet, rule);
    let found = this.tryComponent(name, from, false);
    if (found && found.type === 'component') {
      return found;
    }
    throw new Error(`unable to locate component ${snippet} referred to in rule ${JSON.stringify(rule, null, 2)}`);
  }

  private standardDasherize(snippet: string, rule: PackageRules | ModuleRules): string {
    let name = snippetToDasherizedName(snippet);
    if (name == null) {
      throw new Error(`unable to parse component snippet "${snippet}" from rule ${JSON.stringify(rule, null, 2)}`);
    }
    return name;
  }

  astTransformer(): undefined | string | [string, unknown] {
    if (this.staticComponentsEnabled || this.staticHelpersEnabled || this.staticModifiersEnabled) {
      let opts: ResolverTransformOptions = {
        resolver: this,
        // lexical invocation of helpers was not reliable before Ember 4.2 due to https://github.com/emberjs/ember.js/pull/19878
        patchHelpersBug: semver.satisfies(this.params.emberVersion, '<4.2.0-beta.0', {
          includePrerelease: true,
        }),
      };
      return [require.resolve('./resolver-transform'), opts];
    }
  }

  private humanReadableFile(file: string) {
    if (!this.params.root.endsWith('/')) {
      this.params.root += '/';
    }
    if (file.startsWith(this.params.root)) {
      return file.slice(this.params.root.length);
    }
    return file;
  }

  reportError(dep: ResolutionFail, filename: string, source: string) {
    if (!this.auditHandler && !this.params.options.allowUnsafeDynamicComponents) {
      let e: ResolverDependencyError = new Error(
        `${dep.message}: ${dep.detail} in ${this.humanReadableFile(filename)}`
      );
      e.isTemplateResolverError = true;
      e.loc = dep.loc;
      e.moduleName = filename;
      throw e;
    }
    if (this.auditHandler) {
      this.auditHandler({
        message: dep.message,
        filename,
        detail: dep.detail,
        loc: dep.loc,
        source,
      });
    }
  }

  resolveImport(path: string, from: string): { runtimeName: string; absPath: string } | undefined {
    let absPath;
    try {
      absPath = resolve.sync(path, {
        basedir: dirname(from),
        extensions: this.adjustImportsOptions.resolvableExtensions,
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
    return extensionsPattern(this.adjustImportsOptions.resolvableExtensions);
  }

  private absPathToRuntimePath(absPath: string, owningPackage?: { root: string; name: string }) {
    let pkg = owningPackage || PackageCache.shared('embroider-stage3', this.params.root).ownerOfFile(absPath);
    if (pkg) {
      let packageRuntimeName = pkg.name;
      for (let [runtimeName, realName] of Object.entries(this.adjustImportsOptions.renamePackages)) {
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

  private absPathToRuntimeName(absPath: string, owningPackage?: { root: string; name: string }) {
    return this.absPathToRuntimePath(absPath, owningPackage)
      .replace(this.resolvableExtensionsPattern, '')
      .replace(/\/index$/, '');
  }

  private get staticComponentsEnabled(): boolean {
    return this.params.options.staticComponents || Boolean(this.auditHandler);
  }

  private get staticHelpersEnabled(): boolean {
    return this.params.options.staticHelpers || Boolean(this.auditHandler);
  }

  private get staticModifiersEnabled(): boolean {
    return this.params.options.staticModifiers || Boolean(this.auditHandler);
  }

  private tryHelper(path: string, from: string): HelperResolution | null {
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      let cache = PackageCache.shared('embroider-stage3', this.params.root);
      let packageName = parts[0];
      let renamed = this.adjustImportsOptions.renamePackages[packageName];
      if (renamed) {
        packageName = renamed;
      }
      let owner = cache.ownerOfFile(from)!;
      let targetPackage = owner.name === packageName ? owner : cache.resolve(packageName, owner);
      return this._tryHelper(parts[1], from, targetPackage);
    } else {
      return this._tryHelper(path, from, this.appPackage);
    }
  }

  private _tryHelper(
    path: string,
    from: string,
    targetPackage: Package | AppPackagePlaceholder
  ): HelperResolution | null {
    for (let extension of this.adjustImportsOptions.resolvableExtensions) {
      let absPath = join(targetPackage.root, 'helpers', path) + extension;
      if (pathExistsSync(absPath)) {
        return {
          type: 'helper',
          module: {
            runtimeName: this.absPathToRuntimeName(absPath, targetPackage),
            path: explicitRelative(dirname(from), absPath),
            absPath,
          },
          nameHint: path,
        };
      }
    }
    return null;
  }

  private tryModifier(path: string, from: string): ModifierResolution | null {
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      let cache = PackageCache.shared('embroider-stage3', this.params.root);
      let packageName = parts[0];
      let renamed = this.adjustImportsOptions.renamePackages[packageName];
      if (renamed) {
        packageName = renamed;
      }
      let owner = cache.ownerOfFile(from)!;
      let targetPackage = owner.name === packageName ? owner : cache.resolve(packageName, owner);
      return this._tryModifier(parts[1], from, targetPackage);
    } else {
      return this._tryModifier(path, from, this.appPackage);
    }
  }

  private _tryModifier(
    path: string,
    from: string,
    targetPackage: Package | AppPackagePlaceholder
  ): ModifierResolution | null {
    for (let extension of this.adjustImportsOptions.resolvableExtensions) {
      let absPath = join(targetPackage.root, 'modifiers', path) + extension;
      if (pathExistsSync(absPath)) {
        return {
          type: 'modifier',
          module: {
            runtimeName: this.absPathToRuntimeName(absPath, targetPackage),
            path: explicitRelative(dirname(from), absPath),
            absPath,
          },
          nameHint: path,
        };
      }
    }
    return null;
  }

  @Memoize()
  private get appPackage(): AppPackagePlaceholder {
    return { root: this.params.root, name: this.params.modulePrefix };
  }

  private tryComponent(path: string, from: string, withRuleLookup = true): ComponentResolution | null {
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      let cache = PackageCache.shared('embroider-stage3', this.params.root);
      let packageName = parts[0];
      let renamed = this.adjustImportsOptions.renamePackages[packageName];
      if (renamed) {
        packageName = renamed;
      }
      let owner = cache.ownerOfFile(from)!;
      let targetPackage = owner.name === packageName ? owner : cache.resolve(packageName, owner);

      return this._tryComponent(parts[1], from, withRuleLookup, targetPackage);
    } else {
      return this._tryComponent(path, from, withRuleLookup, this.appPackage);
    }
  }

  private _tryComponent(
    path: string,
    from: string,
    withRuleLookup: boolean,
    targetPackage: Package | AppPackagePlaceholder
  ): ComponentResolution | null {
    let extensions = ['.hbs', ...this.adjustImportsOptions.resolvableExtensions.filter((e: string) => e !== '.hbs')];

    let hbsModule: string | undefined;
    let jsModule: string | undefined;

    // first, the various places our template might be
    for (let extension of extensions) {
      let absPath = join(targetPackage.root, 'templates', 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        hbsModule = absPath;
        break;
      }

      absPath = join(targetPackage.root, 'components', path, 'template') + extension;
      if (pathExistsSync(absPath)) {
        hbsModule = absPath;
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
          hbsModule = absPath;
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
        jsModule = absPath;
        break;
      }

      absPath = join(targetPackage.root, 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        jsModule = absPath;
        break;
      }

      absPath = join(targetPackage.root, 'components', path, 'component') + extension;
      if (pathExistsSync(absPath)) {
        jsModule = absPath;
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
          jsModule = absPath;
          break;
        }
      }
    }

    if (jsModule == null && hbsModule == null) {
      return null;
    }

    let componentRules;
    if (withRuleLookup) {
      // the order here is important. We follow the convention that any rules
      // get attached to the hbsModule if it exists, and only get attached to
      // the jsModule otherwise
      componentRules = this.findComponentRules((hbsModule ?? jsModule)!);
    }
    return {
      type: 'component',
      jsModule: jsModule
        ? {
            path: explicitRelative(dirname(from), jsModule),
            absPath: jsModule,
            runtimeName: this.absPathToRuntimeName(jsModule, targetPackage),
          }
        : null,
      hbsModule: hbsModule
        ? {
            path: explicitRelative(dirname(from), hbsModule),
            absPath: hbsModule,
            runtimeName: this.absPathToRuntimeName(hbsModule, targetPackage),
          }
        : null,
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: path,
    };
  }

  resolveSubExpression(path: string, from: string, loc: Loc): HelperResolution | ResolutionFail | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }
    let found = this.tryHelper(path, from);
    if (found) {
      return found;
    }
    if (builtInHelpers.includes(path)) {
      return null;
    }
    return {
      type: 'error',
      message: `Missing helper`,
      detail: path,
      loc,
    };
  }

  resolveMustache(
    path: string,
    hasArgs: boolean,
    from: string,
    loc: Loc
  ): HelperResolution | ComponentResolution | ResolutionFail | null {
    if (this.staticHelpersEnabled) {
      let found = this.tryHelper(path, from);
      if (found) {
        return found;
      }
    }
    if (this.staticComponentsEnabled) {
      let found = this.tryComponent(path, from);
      if (found) {
        return found;
      }
    }
    if (
      hasArgs &&
      this.staticComponentsEnabled &&
      this.staticHelpersEnabled &&
      !builtInHelpers.includes(path) &&
      !this.isIgnoredComponent(path)
    ) {
      return {
        type: 'error',
        message: `Missing component or helper`,
        detail: path,
        loc,
      };
    } else {
      return null;
    }
  }

  resolveElementModifierStatement(path: string, from: string, loc: Loc): ModifierResolution | ResolutionFail | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }
    let found = this.tryModifier(path, from);
    if (found) {
      return found;
    }
    if (builtInModifiers.includes(path)) {
      return null;
    }
    return {
      type: 'error',
      message: `Missing modifier`,
      detail: path,
      loc,
    };
  }

  resolveElement(tagName: string, from: string, loc: Loc): ComponentResolution | ResolutionFail | null {
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
      found.nameHint = tagName;
      return found;
    }

    if (this.isIgnoredComponent(dName)) {
      return null;
    }

    return {
      type: 'error',
      message: `Missing component`,
      detail: tagName,
      loc,
    };
  }

  resolveComponentHelper(
    component: ComponentLocator,
    from: string,
    loc: Loc,
    impliedBecause?: { componentName: string; argumentName: string }
  ): ComponentResolution | ResolutionFail | null {
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
      return {
        type: 'error',
        message,
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
    if (component.type === 'path') {
      let ownComponentRules = this.findComponentRules(from);
      if (ownComponentRules && ownComponentRules.safeInteriorPaths.includes(component.path)) {
        return null;
      }
      return {
        type: 'error',
        message,
        detail: component.path,
        loc,
      };
    }

    if (builtInComponents.includes(component.path)) {
      return null;
    }

    let found = this.tryComponent(component.path, from);
    if (found) {
      return found;
    }
    return {
      type: 'error',
      message: `Missing component`,
      detail: component.path,
      loc,
    };
  }

  resolveDynamicHelper(helper: ComponentLocator, from: string, loc: Loc): HelperResolution | ResolutionFail | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }

    if (helper.type === 'literal') {
      let helperName = helper.path;
      if (builtInHelpers.includes(helperName)) {
        return null;
      }

      let found = this.tryHelper(helperName, from);
      if (found) {
        return found;
      }
      return {
        type: 'error',
        message: `Missing helper`,
        detail: helperName,
        loc,
      };
    } else {
      return {
        type: 'error',
        message: 'Unsafe dynamic helper',
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
  }

  resolveDynamicModifier(
    modifier: ComponentLocator,
    from: string,
    loc: Loc
  ): ModifierResolution | ResolutionFail | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }

    if (modifier.type === 'literal') {
      let modifierName = modifier.path;
      if (builtInModifiers.includes(modifierName)) {
        return null;
      }

      let found = this.tryModifier(modifierName, from);
      if (found) {
        return found;
      }
      return {
        type: 'error',
        message: `Missing modifier`,
        detail: modifierName,
        loc,
      };
    } else {
      return {
        type: 'error',
        message: 'Unsafe dynamic modifier',
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
  }
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
