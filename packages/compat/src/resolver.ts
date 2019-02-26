import { Resolver, ResolverInstance, Resolution, Options } from "@embroider/core";
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";
import { dasherize } from './string';

// TODO: this depends on the ember version. And it's probably missing some
// private-but-used values.
const builtInHelpers = [
  'action',
  'array',
  'component',
  'concat',
  'debugger',
  'each',
  'each-in',
  'get',
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
  'textarea',
  'unbound',
  'unless',
  'with',
  'yield',
  '-in-element',
  '-get-dynamic-var',
  '-with-dynamic-vars',
];

class CompatResolverInstance implements ResolverInstance {
  private root: string;
  private modulePrefix: string;
  private options: Options;

  constructor({ root, modulePrefix, options }: { root: string, modulePrefix: string, options: Required<Options>}) {
    this.root = root;
    this.modulePrefix = modulePrefix;
    this.options = options;
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
        }))
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
    if (hasArgs && this.options.staticComponents && this.options.staticHelpers && !builtInHelpers.includes(path)) {
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
      // components can't start with lower case
      return null;
    }

    let found = this.tryComponent(dasherize(tagName), from);
    if (found) {
      return found;
    }

    return {
      type: 'error',
      hardFail: true,
      message: `Missing component ${tagName} in ${from}`
    };
  }

  resolveLiteralComponentHelper(path: string, from: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    return this.tryComponent(path, from) || {
      type: 'error',
      hardFail: true,
      message: `Missing component ${path} in ${from}`
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

const CompatResolver: Resolver = CompatResolverInstance;
export default CompatResolver;
