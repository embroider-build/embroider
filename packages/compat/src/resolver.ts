import { Resolver, warn, TemplateCompiler } from "@embroider/core";
import { ComponentRules } from './dependency-rules';
import Options from './options';
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";
import { dasherize } from './string';
import { makeResolverTransform } from './resolver-transform';
import { Memoize } from "typescript-memoize";

type ResolutionResult = {
  type: "component";
  modules: ({runtimeName: string, path: string})[];
  yieldsComponents: Required<ComponentRules>["yieldsSafeComponents"];
  argumentsAreComponents: string[];
} | {
  type: "helper";
  modules: ({runtimeName: string, path: string})[];
};

interface ResolutionFail {
  type: "error";
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

// this is a subset of the full Options. We care about serializability, and we
// only needs parts that are easily serializable, which is why we don't keep the
// whole thing.
type ResolverOptions = Pick<Required<Options>, "staticHelpers" | "staticComponents" | "optionalComponents" | "packageRules">;

function extractOptions(options: Required<Options> | ResolverOptions): ResolverOptions {
  return {
    staticHelpers: options.staticHelpers,
    staticComponents: options.staticComponents,
    optionalComponents: options.optionalComponents,
    packageRules: options.packageRules,
  };
}

export function rehydrate(params: { root: string, modulePrefix: string, options: ResolverOptions }) {
  return new CompatResolver(params);
}

interface PreprocessedComponentRule {
  yieldsSafeComponents: Required<ComponentRules>["yieldsSafeComponents"];
  argumentsAreComponents: string[];
}

export default class CompatResolver implements Resolver {
  private root: string;
  private modulePrefix: string;
  private options: ResolverOptions;
  private dependencies:  Map<string, Resolution[]> = new Map();
  private templateCompiler: TemplateCompiler | undefined;
  private initializingRules = false;

  _parallelBabel: any;

  constructor({ root, modulePrefix, options }: { root: string, modulePrefix: string, options: Required<Options> | ResolverOptions}) {
    this.root = root;
    this.modulePrefix = modulePrefix;
    this.options = extractOptions(options);
    this._parallelBabel = {
      requireFile: __filename,
      buildUsing: 'rehydrate',
      params: {
        root: this.root,
        modulePrefix: this.modulePrefix,
        options: this.options,
      }
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

  @Memoize()
  private get rules() {
    if (!this.templateCompiler) {
      throw new Error(`Bug: Resolver needs to get linked into a TemplateCompiler before it can understand packageRules`);
    }

    // keyed by their first resolved dependency's runtimeName.
    let components: Map<string, PreprocessedComponentRule> = new Map();

    // we're not responsible for filtering out rules for inactive packages here,
    // that is done before getting to us. So we should assume these are all in
    // force.
    for (let rule of this.options.packageRules) {
      if (rule.components) {
        for (let [snippet, componentRules] of Object.entries(rule.components)) {
          let precompiled;
          try {
            this.initializingRules = true;
            precompiled = this.templateCompiler.precompile('rule.hbs', snippet);
          } catch (err) {
            throw new Error(`Cannot understand component name "${snippet}" because "${err.message}" in ${JSON.stringify(rule, null, 2)}`);
          } finally {
            this.initializingRules = false;
          }
          if (precompiled.dependencies.length === 0) {
            throw new Error(`Component name "${snippet}" did not resolve to any modules in rule ${JSON.stringify(rule, null, 2)}`);
          }
          components.set(precompiled.dependencies[0].runtimeName, {
            yieldsSafeComponents: componentRules.yieldsSafeComponents || [],
            argumentsAreComponents: componentRules.acceptsComponentArguments ? componentRules.acceptsComponentArguments.map(entry => {
              let name;
              if (typeof entry === 'string') {
                name = entry;
              } else {
               name = entry.name;
              }
              if (name.startsWith('@')) {
                name = name.slice(1);
              }
              return name;
            }): [],
          });
        }
      }
    }
    return { components };
  }

  astTransformer(templateCompiler: TemplateCompiler): unknown {
    this.templateCompiler = templateCompiler;
    return makeResolverTransform(this);
  }

  dependenciesOf(moduleName: string) {
    let flatDeps: Map<string, string> = new Map();
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
          for (let { runtimeName, path } of dep.modules) {
            flatDeps.set(runtimeName, path);
          }
        }
      }
    }
    return [...flatDeps].map(([runtimeName, path]) => ({ runtimeName, path }));
  }

  private tryHelper(path: string, from: string): Resolution | null {
    let absPath = join(this.root, 'helpers', path) + '.js';
    if (pathExistsSync(absPath)) {
      return {
        type: 'helper',
        modules: [{
          runtimeName: `${this.modulePrefix}/helpers/${path}`,
          path: explicitRelative(from, absPath),
        }]
      };
    }
    return null;
  }

  private tryComponent(path: string, from: string): Resolution | null {
    let componentModules = [
      {
        runtimeName: `${this.modulePrefix}/components/${path}`,
        path: join(this.root, 'components', path) + '.js',
      },
      {
        runtimeName: `${this.modulePrefix}/templates/components/${path}`,
        path: join(this.root, 'templates', 'components', path) + '.hbs',
      },
      {
        runtimeName: `${this.modulePrefix}/templates/components/${path}`,
        path: join(this.root, 'templates', 'components', path) + '.js',
      }
    ].filter(candidate => pathExistsSync(candidate.path));

    if (componentModules.length > 0) {
      let componentRules;
      if (!this.initializingRules) {
        componentRules = this.rules.components.get(componentModules[0].runtimeName);
      }
      return {
        type: 'component',
        modules: componentModules.map(p => ({
          path: explicitRelative(from, p.path),
          runtimeName: p.runtimeName,
        })),
        yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
        argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : []
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
    return this.add({
      type: 'error',
      hardFail: true,
      message: `Missing helper ${path} in ${from}`
    }, from);
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
      !this.options.optionalComponents.includes(path)
    ) {
      return this.add({
        type: 'error',
        hardFail: true,
        message: `Missing component or helper ${path} in ${from}`
      }, from);
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

    let found = this.tryComponent(dName, from);
    if (found) {
      return this.add(found, from);
    }

    if (this.options.optionalComponents.includes(dName)) {
      return null;
    }

    return this.add({
      type: 'error',
      hardFail: true,
      message: `Missing component ${tagName} in ${from}`
    }, from);
  }

  resolveComponentHelper(path: string, isLiteral: boolean, from: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    if (!isLiteral) {
      return this.add({
        type: 'error',
        hardFail: false,
        message: `ignoring dynamic component ${path} in ${humanReadableFile(this.root, from)}`
      }, from);
    }
    let found = this.tryComponent(path, from);
    if (found) {
      return this.add(found, from);
    }
    return this.add({
      type: 'error',
      hardFail: true,
      message: `Missing component ${path} in ${humanReadableFile(this.root, from)}`
    }, from);
  }

  unresolvableComponentArgument(componentName: string, argumentName: string, from: string) {
    this.add({
      type: 'error',
      hardFail: false,
      message: `argument "${argumentName}" to component "${componentName}" in ${humanReadableFile(this.root, from)} is treated as a component, but the value you're passing is dynamic`
    }, from);
  }
}

// by "explicit", I mean that we want "./local/thing" instead of "local/thing"
// because
//     import "./local/thing"
// has a different meaning than
//     import "local/thing"
//
function explicitRelative(fromFile: string, toFile: string) {
  let result = relative(dirname(fromFile), toFile);
  if (!result.startsWith('/') && !result.startsWith('.')) {
    result = './' + result;
  }
  return result;
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
