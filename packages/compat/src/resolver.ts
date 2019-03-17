import { Resolver, Resolution } from "@embroider/core";
import Options from './options';
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";
import { dasherize } from './string';

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
interface ResolverOptions {
  staticHelpers: boolean;
  staticComponents: boolean;
  optionalComponents: string[];
}
function extractOptions(options: Required<Options> | ResolverOptions): ResolverOptions {
  return {
    staticHelpers: options.staticHelpers,
    staticComponents: options.staticComponents,
    optionalComponents: options.optionalComponents,
  };
}

export function rehydrate(params: { root: string, modulePrefix: string, options: ResolverOptions }) {
  return new CompatResolver(params);
}

export default class CompatResolver implements Resolver {
  private root: string;
  private modulePrefix: string;
  private options: ResolverOptions;

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
      return {
        type: 'component',
        modules: componentModules.map(p => ({
          path: explicitRelative(from, p.path),
          runtimeName: p.runtimeName,
        })),
        yieldsComponents: [],
        argumentsAreComponents: [],
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
      return found;
    }
    if (builtInHelpers.includes(path)) {
      return null;
    }
    return {
      type: 'error',
      hardFail: true,
      message: `Missing helper ${path} in ${from}`
    };
  }

  resolveMustache(path: string, hasArgs: boolean, from: string): Resolution | null {
    if (this.options.staticHelpers) {
      let found = this.tryHelper(path, from);
      if (found) {
        return found;
      }
    }
    if (this.options.staticComponents) {
      let found = this.tryComponent(path, from);
      if (found) {
        return found;
      }
    }
    if (
      hasArgs &&
      this.options.staticComponents &&
      this.options.staticHelpers &&
      !builtInHelpers.includes(path) &&
      !this.options.optionalComponents.includes(path)
    ) {
      return {
        type: 'error',
        hardFail: true,
        message: `Missing component or helper ${path} in ${from}`
      };
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
      return found;
    }

    if (this.options.optionalComponents.includes(dName)) {
      return null;
    }

    return {
      type: 'error',
      hardFail: true,
      message: `Missing component ${tagName} in ${from}`
    };
  }

  resolveComponentHelper(path: string, isLiteral: boolean, from: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    if (!isLiteral) {
      return {
        type: 'error',
        hardFail: false,
        message: `ignoring dynamic component ${path} in ${humanReadableFile(this.root, from)}`
      };
    }
    return this.tryComponent(path, from) || {
      type: 'error',
      hardFail: true,
      message: `Missing component ${path} in ${humanReadableFile(this.root, from)}`
    };
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
