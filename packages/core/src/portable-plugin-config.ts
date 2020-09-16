import { compile } from './js-handlebars';
import mapValues from 'lodash/mapValues';

export const protocol = '__embroider_portable_plugin_values__';
const { globalValues, nonce } = setupGlobals();

const template = compile(`
const { PortablePluginConfig } = require('{{{js-string-escape here}}}');
module.exports = PortablePluginConfig.load({{{json-stringify portable 2}}});
`) as (params: { portable: any; here: string }) => string;

interface GlobalPlaceholder {
  embroiderPlaceholder: true;
  type: 'global';
  nonce: number;
  index: number;
}

interface BroccoliParallelPlaceholder {
  embroiderPlaceholder: true;
  type: 'broccoli-parallel';
  requireFile: string;
  useMethod: string | undefined;
  buildUsing: string | undefined;
  params: any;
}

interface HTMLBarsParallelPlaceholder {
  embroiderPlaceholder: true;
  type: 'htmlbars-parallel';
  requireFile: string;
  buildUsing: string;
  params: any;
}

type Placeholder = GlobalPlaceholder | BroccoliParallelPlaceholder | HTMLBarsParallelPlaceholder;

export class PortablePluginConfig {
  protected here = __filename;

  private parallelSafeFlag = true;
  private cachedPortable: any;

  readonly portable: object;
  readonly isParallelSafe: boolean;

  constructor(private config: object) {
    // these properties defined this way because we want getters that are
    // enumerable own properties, such that they will run even when people do
    // things like Object.assign us onto another object or json stringify us.

    this.portable = {}; // this just makes typescript happy, we overwrite it with the defineProperty below
    Object.defineProperty(this, 'portable', {
      enumerable: true,
      get() {
        return this.ensurePortable().portable;
      },
    });

    this.isParallelSafe = true; // this just makes typescript happy, we overwrite it with the defineProperty below
    Object.defineProperty(this, 'isParallelSafe', {
      enumerable: true,
      get() {
        return this.ensurePortable().isParallelSafe;
      },
    });
  }

  private ensurePortable() {
    if (!this.cachedPortable) {
      this.cachedPortable = this.makePortable(this.config);
    }
    return { portable: this.cachedPortable, isParallelSafe: this.parallelSafeFlag };
  }

  serialize(): string {
    // this call to ensurePortable is not strictly needed, but it's cheap
    // because of the cache and it keeps typescript happy since typescript can't
    // see into our defineProperties.
    this.ensurePortable();
    return template({ portable: this.portable, here: this.here });
  }

  protected makePortable(value: any, accessPath: string[] = []): any {
    if (value === null) {
      return value;
    }

    let broccoli = maybeBroccoli(value);
    if (broccoli) {
      return broccoli;
    }

    let htmlbars = maybeHTMLBars(value);
    if (htmlbars) {
      return htmlbars;
    }

    if (Array.isArray(value)) {
      return value.map((element, index) => this.makePortable(element, accessPath.concat(String(index))));
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
        return value;
      case 'object':
        if (Object.getPrototypeOf(value) === Object.prototype) {
          return mapValues(value, (propertyValue, key) => this.makePortable(propertyValue, accessPath.concat(key)));
        }
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
      index,
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
          case 'broccoli-parallel':
            return buildBroccoli(placeholder);
          case 'htmlbars-parallel':
            return buildHTMLBars(placeholder);
        }
      } else {
        return mapValues(input, value => this.load(value));
      }
    }
    return input;
  }
}

function setupGlobals() {
  let G = (global as any) as { [protocol]: { globalValues: any[]; nonce: number } };
  if (!G[protocol]) {
    G[protocol] = { globalValues: [], nonce: Math.floor(Math.random() * Math.pow(2, 32)) };
  }
  return G[protocol];
}

// === broccoli-babel-transpiler support ===

function maybeBroccoli(object: any): BroccoliParallelPlaceholder | undefined {
  const type = typeof object;
  const hasProperties = type === 'function' || (type === 'object' && object !== null);

  if (
    hasProperties &&
    object._parallelBabel !== null &&
    typeof object._parallelBabel === 'object' &&
    typeof object._parallelBabel.requireFile === 'string'
  ) {
    return {
      embroiderPlaceholder: true,
      type: 'broccoli-parallel',
      requireFile: object._parallelBabel.requireFile,
      buildUsing: object._parallelBabel.buildUsing,
      useMethod: object._parallelBabel.useMethod,
      params: object._parallelBabel.params,
    };
  }
}

function buildBroccoli(parallelApiInfo: BroccoliParallelPlaceholder) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let requiredStuff = require(parallelApiInfo.requireFile);

  if (parallelApiInfo.useMethod) {
    if (requiredStuff[parallelApiInfo.useMethod] === undefined) {
      throw new Error(
        "method '" + parallelApiInfo.useMethod + "' does not exist in file " + parallelApiInfo.requireFile
      );
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

// ember-cli-htmlbars-inline-precompile support ===
function maybeHTMLBars(object: any): HTMLBarsParallelPlaceholder | undefined {
  const type = typeof object;
  const hasProperties = type === 'function' || (type === 'object' && object !== null);

  if (
    hasProperties &&
    object.parallelBabel !== null &&
    typeof object.parallelBabel === 'object' &&
    typeof object.parallelBabel.requireFile === 'string'
  ) {
    return {
      embroiderPlaceholder: true,
      type: 'htmlbars-parallel',
      requireFile: object.parallelBabel.requireFile,
      buildUsing: String(object.parallelBabel.buildUsing),
      params: object.parallelBabel.params,
    };
  }
}

function buildHTMLBars(parallelApiInfo: HTMLBarsParallelPlaceholder) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let requiredStuff = require(parallelApiInfo.requireFile);
  if (typeof requiredStuff[parallelApiInfo.buildUsing] !== 'function') {
    throw new Error("'" + parallelApiInfo.buildUsing + "' is not a function in file " + parallelApiInfo.requireFile);
  }
  return requiredStuff[parallelApiInfo.buildUsing](parallelApiInfo.params);
}
