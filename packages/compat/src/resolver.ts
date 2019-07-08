import { Resolver, warn, TemplateCompiler, PackageCache, explicitRelative, extensionsPattern } from '@embroider/core';
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
import { dasherize } from './string';
import { makeResolverTransform } from './resolver-transform';
import { Memoize } from 'typescript-memoize';
import { ResolvedDep } from '@embroider/core/src/resolver';
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
  hardFail: boolean;
  message: string;
}

export type Resolution = ResolutionResult | ResolutionFail;

// TODO: this depends on the ember version. And it's probably missing some
// private-but-used values.
const builtInHelpers = [
  '-get-dynamic-var',
  '-in-element',
  '-with-dynamic-vars',
  'action',
  'array',
  'component',
  'concat',
  'debugger',
  'each-in',
  'each',
  'get',
  'has-block',
  'hasBlock',
  'has-block-params',
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
  options: ResolverOptions;
  activePackageRules: ActivePackageRules[];
  resolvableExtensions: string[];
}

export function rehydrate(params: RehydrationParams) {
  return new CompatResolver(params);
}

export default class CompatResolver implements Resolver {
  private options: ResolverOptions;
  private dependencies: Map<string, Resolution[]> = new Map();
  private templateCompiler: TemplateCompiler | undefined;

  _parallelBabel: {
    requireFile: string;
    buildUsing: string;
    params: RehydrationParams;
  };

  constructor(private params: RehydrationParams) {
    this.options = extractOptions(params.options);
    this._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'rehydrate',
      params,
    };
  }

  enter(moduleName: string) {
    this.dependencies.set(moduleName, []);
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

    // keyed by our own dasherized interpretatino of the component's name.
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
    }
    return { components, ignoredComponents };
  }

  resolveComponentSnippet(snippet: string, rule: PackageRules | ModuleRules): ResolutionResult & { type: 'component' } {
    if (!this.templateCompiler) {
      throw new Error(`bug: tried to use resolveComponentSnippet without a templateCompiler`);
    }
    let name = this.standardDasherize(snippet, rule);
    let found = this.tryComponent(name, 'rule-snippet.hbs', false);
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
    if (ast.type === 'Program' && ast.body.length > 0) {
      let first = ast.body[0];
      if (first.type === 'MustacheStatement' && first.path.type === 'PathExpression') {
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
    if (this.options.staticComponents || this.options.staticHelpers) {
      return makeResolverTransform(this);
    }
  }

  dependenciesOf(moduleName: string): ResolvedDep[] {
    let flatDeps: Map<string, ResolvedDep> = new Map();
    let deps = this.dependencies.get(moduleName);
    if (deps) {
      for (let dep of deps) {
        if (dep.type === 'error') {
          if (dep.hardFail) {
            throw new Error(dep.message);
          } else {
            warn(dep.message);
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
        extensions: this.params.resolvableExtensions,
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
    return extensionsPattern(this.params.resolvableExtensions);
  }

  absPathToRuntimeName(absPath: string) {
    let pkg = PackageCache.shared('embroider-stage3').ownerOfFile(absPath);
    if (pkg) {
      return join(pkg.name, relative(pkg.root, absPath))
        .replace(this.resolvableExtensionsPattern, '')
        .split(sep)
        .join('/');
    } else if (absPath.startsWith(this.params.root)) {
      return join(this.params.modulePrefix, relative(this.params.root, absPath))
        .replace(this.resolvableExtensionsPattern, '')
        .split(sep)
        .join('/');
    }
  }

  private tryHelper(path: string, from: string): Resolution | null {
    for (let extension of this.params.resolvableExtensions) {
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

  private tryComponent(path: string, from: string, withRuleLookup = true): Resolution | null {
    // The order here is important! We always put our .hbs paths first here, so
    // that if we have an hbs file of our own, that will be the first resolved
    // dependency. The first resolved dependency is special because we use that
    // as a key into the rules, and we want to be able to find our rules when
    // checking from our own template (among other times).

    let extensions = ['.hbs', ...this.params.resolvableExtensions.filter(e => e !== '.hbs')];

    let componentModules = [];

    // first, the various places our template might be
    for (let extension of extensions) {
      let absPath = join(this.params.root, 'templates', 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push({
          runtimeName: `${this.params.modulePrefix}/templates/components/${path}`,
          absPath,
        });
        break;
      }

      absPath = join(this.params.root, 'components', path, 'template') + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push({
          runtimeName: `${this.params.modulePrefix}/components/${path}/template`,
          absPath: join(this.params.root, 'components', path, 'template') + extension,
        });
        break;
      }
    }

    // then the various places our javascript might be
    for (let extension of extensions) {
      if (extension === '.hbs') {
        continue;
      }

      let absPath = join(this.params.root, 'components', path) + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push({
          runtimeName: `${this.params.modulePrefix}/components/${path}`,
          absPath,
        });
        break;
      }

      absPath = join(this.params.root, 'components', path, 'component') + extension;
      if (pathExistsSync(absPath)) {
        componentModules.push({
          runtimeName: `${this.params.modulePrefix}/components/${path}/component`,
          absPath,
        });
        break;
      }
    }

    if (componentModules.length > 0) {
      let componentRules;
      if (withRuleLookup) {
        componentRules = this.findComponentRules(componentModules[0].absPath);
      }
      return {
        type: 'component',
        modules: componentModules.map(p => ({
          path: explicitRelative(dirname(from), p.absPath),
          absPath: p.absPath,
          runtimeName: p.runtimeName,
        })),
        yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
        yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
        argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      };
    }

    return null;
  }

  resolveSubExpression(path: string, from: string): Resolution | null {
    if (!this.options.staticHelpers) {
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
        hardFail: true,
        message: `Missing helper ${path} in ${from}`,
      },
      from
    );
  }

  resolveMustache(path: string, hasArgs: boolean, from: string): Resolution | null {
    if (this.options.staticHelpers) {
      let found = this.tryHelper(path, from);
      if (found) {
        return this.add(found, from);
      }
    }
    if (this.options.staticComponents) {
      let found = this.tryComponent(path, from);
      if (found) {
        return this.add(found, from);
      }
    }
    if (
      hasArgs &&
      this.options.staticComponents &&
      this.options.staticHelpers &&
      !builtInHelpers.includes(path) &&
      !this.isIgnoredComponent(path)
    ) {
      return this.add(
        {
          type: 'error',
          hardFail: true,
          message: `Missing component or helper ${path} in ${from}`,
        },
        from
      );
    } else {
      return null;
    }
  }

  resolveElement(tagName: string, from: string): Resolution | null {
    if (!this.options.staticComponents) {
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
        hardFail: true,
        message: `Missing component ${tagName} in ${from}`,
      },
      from
    );
  }

  resolveComponentHelper(path: string, isLiteral: boolean, from: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    if (!isLiteral) {
      let ownComponentRules = this.findComponentRules(from);
      if (ownComponentRules && ownComponentRules.safeInteriorPaths.includes(path)) {
        return null;
      }
      return this.add(
        {
          type: 'error',
          hardFail: false,
          message: `ignoring dynamic component ${path} in ${humanReadableFile(this.params.root, from)}`,
        },
        from
      );
    }
    let found = this.tryComponent(path, from);
    if (found) {
      return this.add(found, from);
    }
    return this.add(
      {
        type: 'error',
        hardFail: true,
        message: `Missing component ${path} in ${humanReadableFile(this.params.root, from)}`,
      },
      from
    );
  }

  unresolvableComponentArgument(componentName: string, argumentName: string, from: string) {
    this.add(
      {
        type: 'error',
        hardFail: false,
        message: `argument "${argumentName}" to component "${componentName}" in ${humanReadableFile(
          this.params.root,
          from
        )} is treated as a component, but the value you're passing is dynamic`,
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
