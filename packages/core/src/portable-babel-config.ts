import { PortablePluginConfig } from './portable-plugin-config';
import { TransformOptions } from '@babel/core';
import resolve from 'resolve';

export type ResolveOptions = { basedir: string } | { resolve: (name: string) => any };

export default class PortableBabelConfig extends PortablePluginConfig {
  private resolve: (name: string) => any;

  constructor(config: TransformOptions, resolveOptions: ResolveOptions) {
    super(config);
    if ('resolve' in resolveOptions) {
      this.resolve = resolveOptions.resolve;
    } else {
      this.basedir = resolveOptions.basedir;
      this.resolve = (name: string) => resolve.sync(name, { basedir: resolveOptions.basedir });
    }
  }

  protected makePortable(value: any, accessPath: string[] = []) {
    if (accessPath.length === 2 && (accessPath[0] === 'plugins' || accessPath[0] === 'presets')) {
      if (typeof value === 'string') {
        return this.resolveBabelPlugin(value);
      }
      if (Array.isArray(value) && typeof value[0] === 'string') {
        let result = [this.resolveBabelPlugin(value[0])];
        if (value.length > 1) {
          result.push(this.makePortable(value[1], accessPath.concat('1')));
        }
        if (value.length > 2) {
          result.push(value[2]);
        }
        return result;
      }
    }
    return super.makePortable(value, accessPath);
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
