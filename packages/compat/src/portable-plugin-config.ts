import { PluginItem, TransformOptions } from '@babel/core';
import resolve from 'resolve';
import { jsHandlebarsCompile as compile } from "@embroider/core";
import isEqual from 'lodash/isEqual';
import mapValues from 'lodash/mapValues';
import assertNever from 'assert-never';

const protocol = '__embroider_portable_plugin_values__';
const { globalValues, nonce } = setupGlobals();

const babelTemplate = compile(`
const { PortableBabelConfig } = require('{{{js-string-escape here}}}');
module.exports = PortableBabelConfig.deserialize({{{json-stringify config 2}}});
`) as (params: {
  config: TransformOptions,
  here: string,
}) => string;

type ResolveOptions  = { basedir: string } | { resolve: (name: string) => any };

interface GlobalPlaceholder {
  embroiderPlaceholder: true;
  type: "global";
  nonce: number;
  index: number;
}

interface ParallelBabelPlaceholder {
  embroiderPlaceholder: true;
  type: "parallelBabel";
  requireFile: "string";
  useMethod: "string" | undefined;
  buildUsing: "string" | undefined;
  params: any;
}

type Placeholder = GlobalPlaceholder | ParallelBabelPlaceholder;

export class PortableBabelConfig {
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
      config.plugins = config.plugins.map((item: PluginItem) => this.portablePlugin(item));
    }
    if (!config.presets) {
      config.presets = [];
    } else {
      config.presets = config.presets.map((preset: PluginItem) => this.portablePlugin(preset));
    }
  }

  private portablePlugin(item: PluginItem): PluginItem {
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

  private makeJSONClean(value: any): any {
    if (value === null) {
      return value;
    } else if (implementsParallelAPI(value)) {
      return parallelBabelPlaceholder(value._parallelBabel);
    } else if (Array.isArray(value)) {
      return value.map(element => this.makeJSONClean(element));
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean': return value;
      case 'object': return mapValues(value, propertyValue => this.makeJSONClean(propertyValue));
    }

    return this.globalPlaceholder(value);
  }

  private globalPlaceholder(value: any): GlobalPlaceholder {
    let index = globalValues.length;
    globalValues.push(value);
    this.isParallelSafe = false;
    return {
      embroiderPlaceholder: true,
      type: 'global',
      nonce,
      index
    };
  }

  static deserialize(input: any): any {
    if (Array.isArray(input)) {
      return input.map(element => this.deserialize(element));
    }
    if (input && typeof input === 'object') {
      if (input.embroiderPlaceholder) {
        let placeholder = input as Placeholder;
        switch (placeholder.type) {
          case 'global':
            if (placeholder.nonce !== nonce) {
              throw new Error(`unable to use this non-serializable babel config in this node process`);
            }
            return globalValues[placeholder.index];
          case 'parallelBabel':
            return buildFromParallelApiInfo(placeholder);
        }
        assertNever(placeholder);
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
    G[protocol] = { globalValues: [], nonce: Math.floor(Math.random() * Math.pow(2, 32)) };

  }
  return G[protocol];
}

function parallelBabelPlaceholder(parallelBabel: any): ParallelBabelPlaceholder {
  return {
    embroiderPlaceholder: true,
    type: 'parallelBabel',
    requireFile: parallelBabel.requireFile,
    buildUsing: parallelBabel.buildUsing,
    useMethod: parallelBabel.useMethod,
    params: parallelBabel.params,
  };
}

// this method is adapted directly out of broccoli-babel-transpiler
function buildFromParallelApiInfo(parallelApiInfo: ParallelBabelPlaceholder) {
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

function implementsParallelAPI(object) {
  const type = typeof object;
  const hasProperties = type === 'function' || (type === 'object' && object !== null) || Array.isArray(object);

  return hasProperties &&
    object._parallelBabel !== null &&
    typeof object._parallelBabel === 'object' &&
    typeof object._parallelBabel.requireFile === 'string';
}
