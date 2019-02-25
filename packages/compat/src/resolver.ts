import { Resolver, ResolverInstance, Resolution } from "@embroider/core";
import { join, relative, dirname } from "path";
import { pathExistsSync } from "fs-extra";

class CompatResolverInstance implements ResolverInstance {
  private root: string;
  private modulePrefix: string;
  constructor({ root, modulePrefix }: { root: string, modulePrefix: string }) {
    this.root = root;
    this.modulePrefix = modulePrefix;
  }
  resolveMustache(path: string, from: string): Resolution | null {
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
    console.log(`TODO: resolve element ${tagName}`);
    return null;
  }
}

const CompatResolver: Resolver = CompatResolverInstance;
export default CompatResolver;
