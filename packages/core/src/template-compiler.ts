import stripBom from 'strip-bom';

export interface Plugins {
  [type: string]: unknown[];
}

export interface Compiler {
  precompile(templateContents: string, options: any): string;
  registerPlugin(type: string, plugin: unknown): void;
  _Ember: any;
}

export default function(compiler: Compiler, EmberENV: unknown, plugins: Plugins) {
  registerPlugins(compiler, plugins);
  initializeEmberENV(compiler, EmberENV);
  return function(moduleName: string, contents: string) {
    let compiled = compiler.precompile(
      stripBom(contents), {
        contents,
        moduleName
      }
    );
    return 'export default Ember.HTMLBars.template('+compiled+');';
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
