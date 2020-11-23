import { TransformOptions } from '@babel/core';
import resolve from 'resolve';
import { Portable } from './portable';

export type ResolveOptions = { basedir: string } | { resolve: (name: string) => any };

export function makePortable(
  config: TransformOptions,
  resolveOptions: ResolveOptions
): { config: TransformOptions; isParallelSafe: boolean } {
  return new PortableBabelConfig(resolveOptions).convert(config);
}

class PortableBabelConfig {
  private resolve: (name: string) => any;
  private basedir: string | undefined;

  constructor(resolveOptions: ResolveOptions) {
    if ('resolve' in resolveOptions) {
      this.resolve = resolveOptions.resolve;
    } else {
      this.basedir = resolveOptions.basedir;
      this.resolve = (name: string) => resolve.sync(name, { basedir: resolveOptions.basedir });
    }
  }

  convert(config: TransformOptions): { config: TransformOptions; isParallelSafe: boolean } {
    let portable: Portable = new Portable({
      dehydrate: (value: any, accessPath: string[]) => {
        // this custom dehydrate hook handles babel plugins & presets. If we're
        // not looking at plugins or presets, continue with stock Portable
        // behavior
        if (accessPath.length !== 2 || (accessPath[0] !== 'plugins' && accessPath[0] !== 'presets')) {
          return undefined;
        }

        // standardize to always handle an array
        if (!Array.isArray(value)) {
          value = [value];
        }

        // there are three allowed parts, the plugin, the arguments, and
        // babel's types show an optional string third argument (I've never
        // seen it used, but the types allow it)
        let [plugin, argument, optionalString] = value;

        // string plugins need to get resolved correctly into absolute paths,
        // so they will really be portable
        if (typeof plugin === 'string') {
          plugin = this.resolveBabelPlugin(plugin);
        }

        // next we deal with serializability. Our Portable system already
        // understands the protocol used by ember-cli-babel to identify plugin
        // classes and get back to their serializable forms, so this will
        // handle that case.
        let dehydrated = portable.dehydrate([plugin, argument, optionalString]);

        if (dehydrated.needsHydrate) {
          //
        }
      },
    });
    let result = portable.dehydrate(config);
    return { config: result.value, isParallelSafe: !result.needsHydrate };
  }

  // babel lets you use relative paths, absolute paths, package names, and
  // package name shorthands.
  //
  // my-plugin  -> my-plugin
  // my-plugin  -> babel-plugin-my-plugin
  // @me/thing  -> @me/thing
  // @me/thing  -> @me/babel-plugin-thing
  // ./here     -> /your/app/here
  // /tmp/there -> /tmp/there
  //
  private resolveBabelPlugin(name: string) {
    try {
      return this.resolve(name);
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
      if (name.startsWith('.') || name.startsWith('/')) {
        throw err;
      }
      try {
        let expanded;
        if (name.startsWith('@')) {
          let [space, pkg, ...rest] = name.split('/');
          expanded = [space, `babel-plugin-${pkg}`, ...rest].join('/');
        } else {
          expanded = `babel-plugin-${name}`;
        }
        return this.resolve(expanded);
      } catch (err2) {
        if (err2.code !== 'MODULE_NOT_FOUND') {
          throw err2;
        }
        if (this.basedir) {
          throw new Error(`unable to resolve babel plugin ${name} from ${this.basedir}`);
        } else {
          throw new Error(`unable to resolve babel plugin ${name}`);
        }
      }
    }
  }
}
