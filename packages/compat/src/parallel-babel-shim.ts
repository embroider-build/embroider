import { compile } from "./js-handlebars";

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

function withOptions(plugin: Function, options: any) {
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
