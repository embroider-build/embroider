import { join } from 'path';
import 'qunit';
import 'jest';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';

export function runDefault(code: string): any {
  let cjsCode = transform7(code, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  })!.code!;
  let exports = {};
  eval(cjsCode);
  return (exports as any).default();
}

export function allBabelVersions(params: {
  babelConfig(major: 6): Options6;
  babelConfig(major: 7): Options7;
  createTests(transform: (code: string) => string): void;
}) {
  let _describe = typeof QUnit !== 'undefined' ? (QUnit.module as any) : describe;

  _describe('babel6', function() {
    let options6: Options6 = params.babelConfig(6);
    if (!options6.filename) {
      options6.filename = 'sample.js';
    }
    params.createTests(function(code: string) {
      return transform6(code, options6).code!;
    });
  });

  _describe('babel7', function() {
    let options7: Options7 = params.babelConfig(7);
    if (!options7.filename) {
      options7.filename = 'sample.js';
    }
    params.createTests(function(code: string) {
      return transform7(code, options7)!.code!;
    });
  });
}

export function emberTemplateCompilerPath() {
  return join(__dirname, 'vendor', 'ember-template-compiler.js');
}

export { Project } from './project';
export { default as BuildResult } from './build';
export { installFileAssertions } from './file-assertions';
