import { PluginItem, PluginOptions, PluginTarget, TransformOptions } from '@babel/core';
import resolve from 'resolve';
import { jsHandlebarsCompile as compile } from "@embroider/core";
import isEqual from 'lodash/isEqual';
import mapValues from 'lodash/mapValues';

const protocol = '__embroider_normalize_plugin_values__';
const { globalValues, nonce } = setupGlobals();

const babelTemplate = compile(`
const { NormalizedBabelConfig } = require('{{{js-string-escape here}}}');
module.exports = NormalizedBabelConfig.deserialize({{{json-stringify config}}});
`) as (params: {
  config: TransformOptions,
  here: string,
}) => string;

type ResolveOptions  = { basedir: string } | { resolve: (name: string) => any };

export class NormalizedBabelConfig {
  private expressions: string[] = [];
  private basedir: string | undefined;
  private resolve: (name: string) => any;
  isParallelSafe = true;

  constructor(private config: TransformOptions, resolveOptions: ResolveOptions) {
    if ('resolve' in resolveOptions) {
      this.resolve = resolveOptions.resolve;
    } else {
      this.basedir = resolveOptions.basedir;
      this.resolve = (name: string) => resolve.sync(name, { basedir: resolveOptions.basedir });
    }
    if (!config.plugins) {
      config.plugins = [];
    } else {
      config.plugins = config.plugins.map((item: PluginItem) => this.normalizePlugin(item));
    }
  }

  private normalizePlugin(item: PluginItem): PluginItem {
    if (typeof item === 'string') {
      return this.resolveBabelPlugin(item);
    }
    if (Array.isArray(item) && typeof item[0] === 'string') {
      let result = [this.resolveBabelPlugin(item[0])];
      if (item.length > 1) {
        result.push(this.makeJSONClean(item[1]));
      }
      if (item.length > 2) {
        result.push(item[2]);
      }
      return result as PluginItem;
    }

    return this.makeJSONClean(item);
  }

  private makeJSONClean(value: any) {
    if (isJSONSafe(value)) {
      return value;
    }
    let index = globalValues.length;
    globalValues.push(value);
    this.isParallelSafe = false;
    return { embroiderPlaceholder: { nonce, index } };
  }

  static deserialize(input: any): any {
    if (Array.isArray(input)) {
      return input.map(element => this.deserialize(element));
    }
    if (input && typeof input === 'object') {
      if (input.embroiderPlaceholder) {
        if (input.embroiderPlaceholder.nonce !== nonce) {
          throw new Error(`unable to use this non-serializable babel config in this node process`);
        }
        return globalValues[input.embroiderPlaceholder.index];
      } else {
        return mapValues(input, value => this.deserialize(value));
      }
    }
    return input;
  }

  serialize(): string {
    return babelTemplate({ config: this.config, here: __filename });
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

function setupGlobals() {
  let G = global as any as { [protocol]: { globalValues: any[], nonce: number }  };
  if (!G[protocol]) {
    G[protocol] = { globalValues: [], nonce: Math.floor(Math.random() * Math.pow(2, 32)) }

  }
  return G[protocol];
}

function isJSONSafe(obj: any) {
  try {
    let after = JSON.parse(JSON.stringify(obj));
    return isEqual(after, obj);
  } catch (err) {
    return false;
  }
}


// this method is adapted directly out of broccoli-babel-transpiler
function buildFromParallelApiInfo(parallelApiInfo: any) {
  let requiredStuff = require(parallelApiInfo.requireFile);

  if (parallelApiInfo.useMethod) {
    if (requiredStuff[parallelApiInfo.useMethod] === undefined) {
      throw new Error("method '" + parallelApiInfo.useMethod + "' does not exist in file " + parallelApiInfo.requireFile);
    }
    return requiredStuff[parallelApiInfo.useMethod];
  }

  if (parallelApiInfo.buildUsing) {
    if (typeof requiredStuff[parallelApiInfo.buildUsing] !== 'function') {
      throw new Error("'" + parallelApiInfo.buildUsing + "' is not a function in file " + parallelApiInfo.requireFile);
    }
    return requiredStuff[parallelApiInfo.buildUsing](parallelApiInfo.params);
  }

  return requiredStuff;
}

function withOptions(plugin: PluginTarget, options: PluginOptions) {
  return function(...args: any[]) {
    let pluginInstance = plugin(...args);
    if (!pluginInstance.visitor) {
      return pluginInstance;
    }
    let wrappedInstance = Object.assign({}, pluginInstance);
    wrappedInstance.visitor = {};
    for (let key of Object.keys(pluginInstance.visitor)) {
      wrappedInstance.visitor[key] = function(path: any, state: any) {
        state.opts = options;
        return pluginInstance.visitor[key](path, state);
      };
    }
    return wrappedInstance;
  };
}

const template =  compile(`
const parallelBabelShim = require('{{{js-string-escape here}}}').default;;
const config = {{{json-stringify config}}};
module.exports = parallelBabelShim(config);
`);

export function synthesize(config: any) {
  return template({ here: __filename, config });
}

export function synthesizeGlobal(pluginInfo: PluginItem ) {
  let g = global as any;
  if (!g.__embroiderSlowBabelPlugins__) {
    g.__embroiderSlowBabelPlugins__ = [];
  }
  let index = g.__embroiderSlowBabelPlugins__.length;

  if (Array.isArray(pluginInfo)) {
    let [plugin, options] = pluginInfo;
    g.__embroiderSlowBabelPlugins__.push(withOptions(plugin, options));
  } else {
    g.__embroiderSlowBabelPlugins__.push(pluginInfo);
  }

  return `if (!global.__embroiderSlowBabelPlugins__) {
    throw new Error('You must run your final stage packager in the same process as CompatApp, because there are unserializable babel plugins')
  };
  module.exports = global.__embroiderSlowBabelPlugins__[${index}];`;
}

export default function parallelBabelShim(parallelApiInfo: any) {
  // this returns a babel plugin configuration entry, which is either a pair or
  // a scalar, so we need to unpack both cases.
  let built = buildFromParallelApiInfo(parallelApiInfo);
  if (Array.isArray(built)) {
    let [plugin, options] = built;
    return withOptions(plugin, options);
  } else {
    // we don't have any options, so there's no wrapping needed. This would be
    // an unusual case because there was no point in using _parallelBabel for
    // this in the first place.
    return built;
  }
}
