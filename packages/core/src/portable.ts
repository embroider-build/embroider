import mapValues from 'lodash/mapValues';
import assertNever from 'assert-never';

export const protocol = '__embroider_portable_values__';
const { globalValues, nonce } = setupGlobals();

export interface PortableResult {
  value: any;
  isParallelSafe: boolean;
  needsHydrate: boolean;
}

export class Portable {
  constructor(
    private opts: {
      dehydrate?: (value: any, accessPath: string[]) => PortableResult | undefined;
      hydrate?: (value: any, accessPath: string[]) => { value: any } | undefined;
    } = {}
  ) {}

  dehydrate(value: any, accessPath: string[] = []): PortableResult {
    if (this.opts.dehydrate) {
      let result = this.opts.dehydrate.call(this, value, accessPath);
      if (result) {
        return result;
      }
    }

    if (value === null) {
      return { value, isParallelSafe: true, needsHydrate: false };
    }

    let broccoli = maybeBroccoli(value);
    if (broccoli) {
      return { value: broccoli, isParallelSafe: true, needsHydrate: true };
    }

    let htmlbars = maybeHTMLBars(value);
    if (htmlbars) {
      return { value: htmlbars, isParallelSafe: true, needsHydrate: true };
    }

    if (Array.isArray(value)) {
      let results = value.map((element, index) => this.dehydrate(element, accessPath.concat(String(index))));
      return {
        value: results.map(r => r.value),
        isParallelSafe: results.every(r => r.isParallelSafe),
        needsHydrate: results.some(r => r.needsHydrate),
      };
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'undefined':
        return { value, isParallelSafe: true, needsHydrate: false };
      case 'object':
        if (Object.getPrototypeOf(value) === Object.prototype) {
          let isParallelSafe = true;
          let needsHydrate = false;
          let result = mapValues(value, (propertyValue, key) => {
            let result = this.dehydrate(propertyValue, accessPath.concat(key));
            isParallelSafe = isParallelSafe && result.isParallelSafe;
            needsHydrate = needsHydrate || result.needsHydrate;
            return result.value;
          });
          return { value: result, isParallelSafe, needsHydrate };
        }
    }

    return globalPlaceholder(value);
  }

  hydrate(input: any, accessPath: string[] = []): any {
    if (this.opts.hydrate) {
      let result = this.opts.hydrate.call(this, input, accessPath);
      if (result) {
        return result;
      }
    }
    if (Array.isArray(input)) {
      return input.map((element, index) => this.hydrate(element, accessPath.concat(String(index))));
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
          default:
            assertNever(placeholder);
        }
      } else {
        return mapValues(input, (value, key) => this.hydrate(value, accessPath.concat(key)));
      }
    }
    return input;
  }
}

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

function globalPlaceholder(value: any): { value: GlobalPlaceholder; isParallelSafe: false; needsHydrate: true } {
  let index = globalValues.length;
  globalValues.push(value);
  return {
    value: {
      embroiderPlaceholder: true,
      type: 'global',
      nonce,
      index,
    },
    isParallelSafe: false,
    needsHydrate: true,
  };
}
