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
  extensionsPattern,
  ResolverOptions as CoreResolverOptions,
  Resolver,
} from '@embroider/core';
import { join, relative, sep, resolve as pathResolve } from 'path';

import { Memoize } from 'typescript-memoize';
import Options from './options';
import { dasherize, snippetToDasherizedName } from './dasherize-component-name';

export interface ResolvedDep {
  runtimeName: string;
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
  module: { absPath: string };
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
type UserConfig = Pick<
  Required<Options>,
  'staticHelpers' | 'staticModifiers' | 'staticComponents' | 'allowUnsafeDynamicComponents'
>;

function extractOptions(options: Required<Options> | UserConfig): UserConfig {
  return {
    staticHelpers: options.staticHelpers,
    staticModifiers: options.staticModifiers,
    staticComponents: options.staticComponents,
    allowUnsafeDynamicComponents: options.allowUnsafeDynamicComponents,
  };
}

export interface CompatResolverOptions extends CoreResolverOptions {
  modulePrefix: string;
  podModulePrefix?: string;
  emberVersion: string;
  activePackageRules: ActivePackageRules[];
  options: UserConfig;
}

export function rehydrate(params: CompatResolverOptions) {
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
    params: CompatResolverOptions;
  };

  private resolver: Resolver;

  constructor(private params: CompatResolverOptions) {
    this.params.options = extractOptions(this.params.options);
    this._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'rehydrate',
      params,
    };
    this.resolver = new Resolver(this.params);
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
      for (let ext of this.params.resolvableExtensions) {
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
              components.set(join(this.params.appRoot, componentRules.layout.appPath), processedRules);
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
          components.set(join(this.params.appRoot, path), processedRules);
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

  private humanReadableFile(file: string) {
    if (!this.params.appRoot.endsWith('/')) {
      this.params.appRoot += '/';
    }
    if (file.startsWith(this.params.appRoot)) {
      return file.slice(this.params.appRoot.length);
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
    let resolution = this.resolver.nodeResolve(path, from);
    if (resolution.type === 'real') {
      let runtimeName = this.absPathToRuntimeName(resolution.filename);
      if (runtimeName) {
        return { runtimeName, absPath: resolution.filename };
      }
    }
  }

  @Memoize()
  private get resolvableExtensionsPattern() {
    return extensionsPattern(this.params.resolvableExtensions);
  }

  private absPathToRuntimePath(absPath: string, owningPackage?: { root: string; name: string }) {
    let pkg = owningPackage || PackageCache.shared('embroider-stage3', this.params.appRoot).ownerOfFile(absPath);
    if (pkg) {
      let packageRuntimeName = pkg.name;
      for (let [runtimeName, realName] of Object.entries(this.params.renamePackages)) {
        if (realName === packageRuntimeName) {
          packageRuntimeName = runtimeName;
          break;
        }
      }
      return join(packageRuntimeName, relative(pkg.root, absPath)).split(sep).join('/');
    } else if (absPath.startsWith(this.params.appRoot)) {
      return join(this.params.modulePrefix, relative(this.params.appRoot, absPath)).split(sep).join('/');
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

  private containingEngine(_filename: string): Package | AppPackagePlaceholder {
    // FIXME: when using engines, template global resolution is scoped to the
    // engine not always the app. We already have code in the app-tree-merging
    // to deal with that, so as we unify that with the module-resolving system
    // we should be able to generate a better answer here.
    return this.appPackage;
  }

  private parsePath(path: string, fromFile: string) {
    let engine = this.containingEngine(fromFile);
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      return { packageName: parts[0], memberName: parts[1], from: pathResolve(engine.root, './package.json') };
    } else {
      return { packageName: engine.name, memberName: path, from: pathResolve(engine.root, './package.json') };
    }
  }

  private tryHelper(path: string, from: string): HelperResolution | null {
    let target = this.parsePath(path, from);
    let runtimeName = `${target.packageName}/helpers/${target.memberName}`;
    let resolution = this.resolver.nodeResolve(runtimeName, target.from);
    if (resolution.type === 'real') {
      return {
        type: 'helper',
        module: {
          absPath: resolution.filename,
          runtimeName,
        },
        nameHint: target.memberName,
      };
    }
    return null;
  }

  private tryModifier(path: string, from: string): ModifierResolution | null {
    let target = this.parsePath(path, from);
    let resolution = this.resolver.nodeResolve(`${target.packageName}/modifiers/${target.memberName}`, target.from);
    if (resolution.type === 'real') {
      return {
        type: 'modifier',
        module: {
          absPath: resolution.filename,
        },
        nameHint: path,
      };
    }
    return null;
  }

  @Memoize()
  private get appPackage(): AppPackagePlaceholder {
    return { root: this.params.appRoot, name: this.params.modulePrefix };
  }

  private *componentTemplateCandidates(target: { packageName: string; memberName: string }) {
    yield join(target.packageName, 'templates', 'components', target.memberName);
    yield join(target.packageName, 'components', target.memberName, 'template');

    if (
      typeof this.params.podModulePrefix !== 'undefined' &&
      this.params.podModulePrefix !== '' &&
      target.packageName === this.appPackage.name
    ) {
      yield join(this.params.podModulePrefix, 'components', target.memberName, 'template');
    }
  }

  private *componentJSCandidates(target: { packageName: string; memberName: string }) {
    yield join(target.packageName, 'components', target.memberName);
    yield join(target.packageName, 'components', target.memberName, 'component');

    if (
      typeof this.params.podModulePrefix !== 'undefined' &&
      this.params.podModulePrefix !== '' &&
      target.packageName === this.appPackage.name
    ) {
      yield join(this.params.podModulePrefix, 'components', target.memberName, 'component');
    }
  }

  private tryComponent(path: string, from: string, withRuleLookup = true): ComponentResolution | null {
    const target = this.parsePath(path, from);

    let hbsModule: ResolvedDep | null = null;
    let jsModule: ResolvedDep | null = null;

    // first, the various places our template might be.
    for (let candidate of this.componentTemplateCandidates(target)) {
      let resolution = this.resolver.nodeResolve(candidate, target.from);
      if (resolution.type === 'real') {
        hbsModule = { absPath: resolution.filename, runtimeName: candidate };
        break;
      }
    }

    // then the various places our javascript might be.
    for (let candidate of this.componentJSCandidates(target)) {
      let resolution = this.resolver.nodeResolve(candidate, target.from);
      // .hbs is a resolvable extension for us, so we need to exclude it here.
      // It matches as a priority lower than .js, so finding an .hbs means
      // there's definitely not a .js.
      if (resolution.type === 'real' && !resolution.filename.endsWith('.hbs')) {
        jsModule = { absPath: resolution.filename, runtimeName: candidate };
        break;
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
      componentRules = this.findComponentRules((hbsModule ?? jsModule)!.absPath);
    }
    return {
      type: 'component',
      jsModule: jsModule,
      hbsModule: hbsModule,
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: target.memberName,
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
