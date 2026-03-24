import type { PortableHint } from './portable';
import { Portable } from './portable';

export default function babelLauncher(
  this: any,
  babel: any,
  launch: { module: any; arg: any; hints: PortableHint[] },
  key: string
) {
  let p = new Portable({ hints: launch.hints });
  let hydrated = p.hydrate(launch);
  let module;
  if (typeof hydrated.module === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require(hydrated.module);
    if (module.__esModule) {
      module = module.default;
    }
  } else {
    module = hydrated.module;
  }

  let plugin = module.call(this, babel, hydrated.arg, key);
  let innerStates = new WeakMap();

  function convertState(state: any) {
    let innerState = innerStates.get(state);
    if (!innerState) {
      innerState = Object.assign({}, state, { opts: hydrated.arg });
      innerStates.set(state, innerState);
    }
    return innerState;
  }

  function wrap1(original: any) {
    if (typeof original === 'function') {
      return function (this: any, file: any) {
        return original.call(convertState(this), file);
      };
    }
  }

  function wrap2(original: Function) {
    return function (this: any, path: any, state: any) {
      return original.call(convertState(this), path, convertState(state));
    };
  }

  let visitorProxy = {
    get(target: any, prop: string) {
      let original = target[prop];
      if (typeof original === 'function') {
        return wrap2(original);
      }
      if (original && typeof original === 'object') {
        let wrapped: any = {};
        if (typeof original.exit === 'function') {
          wrapped.exit = wrap2(original.exit);
        }
        if (typeof original.enter === 'function') {
          wrapped.enter = wrap2(original.enter);
        }
        return wrapped;
      }
      return original;
    },
  };

  return new Proxy(plugin, {
    get(target, prop) {
      let original = target[prop];
      switch (prop) {
        case 'pre':
        case 'post':
          return wrap1(original);
        case 'visitor':
          return new Proxy(original, visitorProxy);
        default:
          return original;
      }
    },
  });
}
