import resolve from 'resolve';
import { compile } from './js-handlebars';
import mapValues from 'lodash/mapValues';
import assertNever from 'assert-never';

const protocol = '__embroider_portable_plugin_values__';
const { globalValues, nonce } = setupGlobals();

const template = compile(`
const { PortablePluginConfig } = require('{{{js-string-escape here}}}');
module.exports = {
  config: PortablePluginConfig.load({{{json-stringify portable 2}}}),
  isParallelSafe: {{ isParallelSafe }},
};
`) as (params: {
  portable: any,
  here: string,
  isParallelSafe: boolean,
}) => string;

export type ResolveOptions  = { basedir: string } | { resolve: (name: string) => any };

interface GlobalPlaceholder {
  embroiderPlaceholder: true;
  type: "global";
  nonce: number;
  index: number;
}

interface ParallelPlaceholder {
  embroiderPlaceholder: true;
  type: "parallel";
  requireFile: "string";
  useMethod: "string" | undefined;
  buildUsing: "string" | undefined;
  params: any;
}

type Placeholder = GlobalPlaceholder | ParallelPlaceholder;

export class PortablePluginConfig {
  protected basedir: string | undefined;
  protected resolve: (name: string) => any;
  protected here = __filename;

  private parallelSafeFlag = true;

  readonly portable: any;
  readonly isParallelSafe: boolean;

  constructor(private config: any, resolveOptions: ResolveOptions) {
    if ('resolve' in resolveOptions) {
      this.resolve = resolveOptions.resolve;
    } else {
      this.basedir = resolveOptions.basedir;
      this.resolve = (name: string) => resolve.sync(name, { basedir: resolveOptions.basedir });
    }
    this.portable = this.makePortable(this.config);
    this.isParallelSafe = this.parallelSafeFlag;
  }

  serialize(): string {
    return template({ portable: this.portable, here: this.here, isParallelSafe: this.isParallelSafe });
  }

  protected makePortable(value: any, accessPath: string[] = []): any {
    if (value === null) {
      return value;
    } else if (implementsParallelAPI(value)) {
      return parallelPlaceholder(value._parallelBabel);
    } else if (Array.isArray(value)) {
      return value.map((element, index) => this.makePortable(element, accessPath.concat(String(index))));
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean': return value;
      case 'object': return mapValues(value, (propertyValue, key) => this.makePortable(propertyValue, accessPath.concat(key)));
    }

    return this.globalPlaceholder(value);
  }

  private globalPlaceholder(value: any): GlobalPlaceholder {
    let index = globalValues.length;
    globalValues.push(value);
    this.parallelSafeFlag = false;
    return {
      embroiderPlaceholder: true,
      type: 'global',
      nonce,
      index
    };
  }

  static load(input: any): any {
    if (Array.isArray(input)) {
      return input.map(element => this.load(element));
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
          case 'parallel':
            return buildFromParallelApiInfo(placeholder);
        }
        assertNever(placeholder);
      } else {
        return mapValues(input, value => this.load(value));
      }
    }
    return input;
  }
}

function setupGlobals() {
  let G = global as any as { [protocol]: { globalValues: any[], nonce: number }  };
  if (!G[protocol]) {
    G[protocol] = { globalValues: [], nonce: Math.floor(Math.random() * Math.pow(2, 32)) };

  }
  return G[protocol];
}

function parallelPlaceholder(parallelBabel: any): ParallelPlaceholder {
  return {
    embroiderPlaceholder: true,
    type: 'parallel',
    requireFile: parallelBabel.requireFile,
    buildUsing: parallelBabel.buildUsing,
    useMethod: parallelBabel.useMethod,
    params: parallelBabel.params,
  };
}

// this method is adapted directly out of broccoli-babel-transpiler
function buildFromParallelApiInfo(parallelApiInfo: ParallelPlaceholder) {
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

function implementsParallelAPI(object: any) {
  const type = typeof object;
  const hasProperties = type === 'function' || (type === 'object' && object !== null) || Array.isArray(object);

  return hasProperties &&
    object._parallelBabel !== null &&
    typeof object._parallelBabel === 'object' &&
    typeof object._parallelBabel.requireFile === 'string';
}
