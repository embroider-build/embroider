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
import { snippetToDasherizedName } from './dasherize-component-name';

export interface ResolvedDep {
  runtimeName: string;
  absPath: string;
}

export interface EagerComponentResolution {
  type: 'component';
  jsModule: ResolvedDep | null;
  hbsModule: ResolvedDep | null;
  yieldsComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
  nameHint: string;
}

export interface DeferedComponentResolution {
  type: 'component';
  specifier: string;
  yieldsComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
  nameHint: string;
}

export type ComponentResolution = EagerComponentResolution | DeferedComponentResolution;

export type HelperResolution =
  | {
      type: 'helper';
      nameHint: string;
      specifier: string;
    }
  | {
      type: 'helper';
      nameHint: string;
      module: ResolvedDep;
    };

export type ModifierResolution =
  | {
      type: 'modifier';
      module: { absPath: string };
      nameHint: string;
    }
  | {
      type: 'modifier';
      specifier: string;
      nameHint: string;
    };

export type ResolutionResult = ComponentResolution | HelperResolution | ModifierResolution;

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
export const builtInHelpers = [
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

export const builtInComponents = ['input', 'link-to', 'textarea'];

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
  activePackageRules: ActivePackageRules[];
  options: UserConfig;
}

export interface AuditMessage {
  message: string;
  detail: string;
  loc: Loc;
  source: string;
  filename: string;
}

export default class CompatResolver {
  private resolver: Resolver;

  constructor(private params: CompatResolverOptions) {
    this.params.options = extractOptions(this.params.options);
    this.resolver = new Resolver(this.params);
  }
  enter(moduleName: string) {
    let rules = this.findInteriorRules(moduleName);
    let deps: EagerComponentResolution[];
    if (rules?.dependsOnComponents) {
      deps = rules.dependsOnComponents.map(snippet => this.resolveComponentSnippet(snippet, rules!, moduleName));
    } else {
      deps = [];
    }
    return deps;
  }
  findInteriorRules(absPath: string): PreprocessedComponentRule['interior'] | undefined {
    let rules = this.rules.interiorRules.get(absPath);
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
          let rules = this.rules.interiorRules.get(stem + ext);
          if (rules) {
            return rules;
          }
        }
      }
    }
    return undefined;
  }

  isIgnoredComponent(dasherizedName: string) {
    return this.rules.exteriorRules.get(dasherizedName)?.safeToIgnore;
  }

  @Memoize()
  get rules() {
    // keyed by their first resolved dependency's absPath.
    let interiorRules: Map<string, PreprocessedComponentRule['interior']> = new Map();

    // keyed by our dasherized interpretation of the component's name
    let exteriorRules: Map<string, PreprocessedComponentRule['exterior']> = new Map();

    // we're not responsible for filtering out rules for inactive packages here,
    // that is done before getting to us. So we should assume these are all in
    // force.
    for (let rule of this.params.activePackageRules) {
      if (rule.components) {
        for (let [snippet, componentRules] of Object.entries(rule.components)) {
          let processedRules = preprocessComponentRule(componentRules);
          let dasherizedName = this.standardDasherize(snippet, rule);
          exteriorRules.set(dasherizedName, processedRules.exterior);
          if (processedRules.exterior.safeToIgnore) {
            continue;
          }

          let resolvedSnippet = this.resolveComponentSnippet(
            snippet,
            rule,
            pathResolve(this.params.appRoot, 'package.json')
          );

          // cast is OK here because a component must have one or the other
          let resolvedDep = (resolvedSnippet.hbsModule ?? resolvedSnippet.jsModule)!;

          // we always register our rules on the component's own first resolved
          // module, which must be a module in the app's module namespace.
          interiorRules.set(resolvedDep.absPath, processedRules.interior);

          // if there's a custom layout, we also need to register our rules on
          // those templates.
          if (componentRules.layout) {
            if (componentRules.layout.appPath) {
              interiorRules.set(join(this.params.appRoot, componentRules.layout.appPath), processedRules.interior);
            } else if (componentRules.layout.addonPath) {
              for (let root of rule.roots) {
                interiorRules.set(join(root, componentRules.layout.addonPath), processedRules.interior);
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
          interiorRules.set(join(this.params.appRoot, path), processedRules.interior);
        }
      }
      if (rule.addonTemplates) {
        for (let [path, templateRules] of Object.entries(rule.addonTemplates)) {
          let processedRules = preprocessComponentRule(templateRules);
          for (let root of rule.roots) {
            interiorRules.set(join(root, path), processedRules.interior);
          }
        }
      }
    }
    return { interiorRules, exteriorRules };
  }

  resolveComponentSnippet(snippet: string, rule: PackageRules | ModuleRules, from: string): EagerComponentResolution {
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

  @Memoize()
  private get appPackage(): AppPackagePlaceholder {
    return { root: this.params.appRoot, name: this.params.modulePrefix };
  }

  private *componentTemplateCandidates(target: { packageName: string; memberName: string }) {
    yield `${target.packageName}/templates/components/${target.memberName}`;
    yield `${target.packageName}/components/${target.memberName}/template`;

    if (
      typeof this.params.podModulePrefix !== 'undefined' &&
      this.params.podModulePrefix !== '' &&
      target.packageName === this.appPackage.name
    ) {
      yield `${this.params.podModulePrefix}/components/${target.memberName}/template`;
    }
  }

  private *componentJSCandidates(target: { packageName: string; memberName: string }) {
    yield `${target.packageName}/components/${target.memberName}`;
    yield `${target.packageName}/components/${target.memberName}/component`;

    if (
      typeof this.params.podModulePrefix !== 'undefined' &&
      this.params.podModulePrefix !== '' &&
      target.packageName === this.appPackage.name
    ) {
      yield `${this.params.podModulePrefix}/components/${target.memberName}/component`;
    }
  }

  private tryComponent(path: string, from: string, withRuleLookup = true): EagerComponentResolution | null {
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
      componentRules = this.rules.exteriorRules.get(path);
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
