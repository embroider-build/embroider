import stripBom from 'strip-bom';

export interface Plugins {
  [type: string]: unknown[];
}

export interface Compiler {
  precompile(templateContents: string, options: any): string;
  registerPlugin(type: string, plugin: unknown): void;
  _Ember: any;
}

const dependencies: Map<string, Set<string>> = new Map();

function buildTimeResolver(env: { moduleName: string }) {
  let deps = new Set();
  dependencies.set(env.moduleName, deps);
  return {
    name: 'embroider-build-time-resolver',
    visitor: {
      MustacheStatement(node: any) {
        //deps.add(node.path.original);
        if (node.path.original === 'welcome-page') {
          console.log(env);
          debugger;
        }
        console.log(`mustache path: ${node.path.original}`);
      },
      ElementNode(node: any) {
        console.log(`element: ${node.tag}`);
      },
    }
  };
}

export default function(compiler: Compiler, EmberENV: unknown, plugins: Plugins) {
  registerPlugins(compiler, plugins);
  compiler.registerPlugin('ast', buildTimeResolver);
  initializeEmberENV(compiler, EmberENV);
  return function(moduleName: string, contents: string) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    let deps = dependencies.get(moduleName);
    let lines = [...deps!].map(d => `import "${d}";`);
    lines.push(`export default Ember.HTMLBars.template(${compiled});`);
    return lines.join("\n");
  };
}

function registerPlugins(compiler: Compiler, plugins: Plugins) {
  for (let type in plugins) {
    for (let i = 0, l = plugins[type].length; i < l; i++) {
      compiler.registerPlugin(type, plugins[type][i]);
    }
  }
}

function initializeEmberENV(templateCompiler: Compiler, EmberENV: any) {
  if (!templateCompiler || !EmberENV) { return; }

  let props;

  if (EmberENV.FEATURES) {
    props = Object.keys(EmberENV.FEATURES);

    props.forEach(prop => {
      templateCompiler._Ember.FEATURES[prop] = EmberENV.FEATURES[prop];
    });
  }

  if (EmberENV) {
    props = Object.keys(EmberENV);

    props.forEach(prop => {
      if (prop === 'FEATURES') { return; }

      templateCompiler._Ember.ENV[prop] = EmberENV[prop];
    });
  }
}
