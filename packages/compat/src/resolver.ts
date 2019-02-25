import { Resolver, ResolverInstance, Resolution, Options } from "@embroider/core";
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";

class CompatResolverInstance implements ResolverInstance {
  private root: string;
  private modulePrefix: string;
  private options: Options;

  constructor({ root, modulePrefix, options }: { root: string, modulePrefix: string, options: Required<Options>}) {
    this.root = root;
    this.modulePrefix = modulePrefix;
    this.options = options;
  }

  resolveSubExpression(path: string, from: string): Resolution | null {
    if (!this.options.staticHelpers) {
      return null;
    }
    let absPath = join(this.root, 'helpers', path) + '.js';
    if (pathExistsSync(absPath)) {
      return {
        type: 'helper',
        modules: [{
          runtimeName: `${this.modulePrefix}/helpers/${path}`,
          path: relative(dirname(from), absPath),
        }]
      };
    }
    return null;
  }

  resolveMustache(path: string, from: string): Resolution | null {
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
          path: relative(dirname(from), p.path),
          runtimeName: p.runtimeName,
        }))
      };
    }

    return null;
  }
  resolveElement(tagName: string): Resolution | null {
    if (!this.options.staticComponents) {
      return null;
    }
    console.log(`TODO: resolve element ${tagName}`);
    return null;
  }
}

const CompatResolver: Resolver = CompatResolverInstance;
export default CompatResolver;
