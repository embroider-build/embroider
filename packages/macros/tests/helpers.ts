import 'qunit';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';
import { MacrosConfig } from '..';
import { join } from 'path';

export function runDefault(code: string, preamble = ""): any {
  let cjsCode = transform7(preamble + "\n" + code, {
    plugins: ['@babel/plugin-transform-modules-commonjs']
  })!.code!;
  let exports = {};
  eval(cjsCode);
  return (exports as any).default();
}

export function allBabelVersions(createTests: (transform: (code: string) => string, config: MacrosConfig) => void, opts?: { classicMode?: boolean }) {
  QUnit.module('babel6', function() {
    let config = new MacrosConfig();
    createTests(function(code: string){
      const options6: Options6 = {
        filename: join(__dirname, 'sample.js'),
        presets: [],
        plugins: [config.babelPluginConfig(opts && opts.classicMode ? '/imaginary/path/to/package' : undefined)]
      };
      return transform6(code, options6).code!;
    }, config);
  });
  QUnit.module('babel7', function() {
    let config = new MacrosConfig();
    createTests(function(code: string) {
      const options7: Options7 = {
        filename: join(__dirname, 'sample.js'),
        presets: [],
        plugins: [config.babelPluginConfig(opts && opts.classicMode ? '/imaginary/path/to/package' : undefined)]
      };
      return transform7(code, options7)!.code!;
    }, config);
  });
}
