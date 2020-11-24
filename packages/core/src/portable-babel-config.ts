import { TransformOptions } from '@babel/core';
import { join } from 'path';
import resolve from 'resolve';
import { Portable, PortableHint } from './portable';

export type ResolveOptions = { basedir: string } | { resolve: (name: string) => any };

export function makePortable(
  config: TransformOptions,
  resolveOptions: ResolveOptions,
  hints: PortableHint[]
): { config: TransformOptions; isParallelSafe: boolean } {
  return new PortableBabelConfig(resolveOptions, hints).convert(config);
}

class PortableBabelConfig {
  private resolve: (name: string) => any;
  private basedir: string | undefined;

  constructor(resolveOptions: ResolveOptions, private hints: PortableHint[]) {
    if ('resolve' in resolveOptions) {
      this.resolve = resolveOptions.resolve;
    } else {
      this.basedir = resolveOptions.basedir;
      this.resolve = (name: string) => resolve.sync(name, { basedir: resolveOptions.basedir });
    }
  }

  convert(config: TransformOptions): { config: TransformOptions; isParallelSafe: boolean } {
    let portable: Portable = new Portable({
      hints: this.hints,
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

        let [plugin, argument, asName] = value;

        // string plugins need to get resolved correctly into absolute paths,
        // so they will really be portable
        if (typeof plugin === 'string') {
          plugin = this.resolveBabelPlugin(plugin);
        }

        // next we deal with serializability. Our Portable system already
        // understands the protocol used by ember-cli-babel to identify plugin
        // classes and get back to their serializable forms, so this will
        // handle that case.
        let dehydrated = portable.dehydrate([plugin, argument, asName], accessPath.concat('_internal'));

        if (dehydrated.needsHydrate) {
          // we can eliminate the need for rehydration by going through our own
          // portable babel launcher
          return {
            value: [
              join(__dirname, 'portable-babel-launcher.js'),
              { module: dehydrated.value[0], arg: dehydrated.value[1], hints: this.hints },
              dehydrated.value[2] || `portable-babel-launcher-${accessPath[1]}`,
            ],
            needsHydrate: false,
            isParallelSafe: dehydrated.isParallelSafe,
          };
        } else {
          // trim back down our array, because trailing undefined will get
          // converted into null via json.stringify, and babel will complain
          // about that.
          while (dehydrated.value[dehydrated.value.length - 1] == null) {
            dehydrated.value.pop();
          }
          if (dehydrated.value.length === 1) {
            dehydrated.value = dehydrated.value[0];
          }
          return {
            value: dehydrated.value,
            needsHydrate: dehydrated.needsHydrate,
            isParallelSafe: dehydrated.isParallelSafe,
          };
        }
      },
    });
    let result = portable.dehydrate(config);
    if (result.needsHydrate) {
      throw new Error(`bug: portable babel configs aren't supposed to need hydration`);
    }
    return { config: result.value, isParallelSafe: result.isParallelSafe };
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
