import { Resolver, ResolverInstance, Resolution, Options } from "@embroider/core";
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";
import { dasherize } from './string';

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
    if (!this.options.staticHelpers) {
      return null;
    }
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
    if (!this.options.staticComponents) {
      return null;
    }
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
    return this.tryHelper(path, from);
  }

  resolveMustache(path: string, from: string): Resolution | null {
    return this.tryHelper(path, from) || this.tryComponent(path, from);
  }

  resolveElement(tagName: string, from: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    if (tagName[0] === tagName[0].toLowerCase()) {
      // components can't start with lower case
      return null;
    }
    return this.tryComponent(dasherize(tagName), from) ||  {
      type: 'error',
      hardFail: true,
      message: `Missing component ${tagName} in ${from}`
    };
  }

  resolveLiteralComponentHelper(path: string, from: string): Resolution {
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
