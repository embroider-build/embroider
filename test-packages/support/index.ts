import { join } from 'path';
import 'qunit';
import 'jest';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';
import escapeRegExp from 'lodash/escapeRegExp';

export function runDefault(code: string): any {
  let cjsCode = transform7(code, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  })!.code!;
  let exports = {};
  eval(cjsCode);
  return (exports as any).default();
}

function presetsFor(major: 6 | 7) {
  return [
    [
      require.resolve(major === 6 ? 'babel-preset-env' : '@babel/preset-env'),
      {
        modules: false,
        targets: {
          ie: '11.0.0',
        },
      },
    ],
  ];
}

export function allBabelVersions(params: {
  babelConfig(major: 6): Options6;
  babelConfig(major: 7): Options7;
  createTests(transform: (code: string) => string): void;
  includePresetsTests?: boolean;
}) {
  let _describe = typeof QUnit !== 'undefined' ? (QUnit.module as any) : describe;

  function versions(usePresets: boolean) {
    _describe('babel6', function() {
      params.createTests(function(code: string) {
        let options6: Options6 = params.babelConfig(6);
        if (!options6.filename) {
          options6.filename = 'sample.js';
        }
        if (usePresets) {
          options6.presets = presetsFor(6);
        }

        return transform6(code, options6).code!;
      });
    });

    _describe('babel7', function() {
      params.createTests(function(code: string) {
        let options7: Options7 = params.babelConfig(7);
        if (!options7.filename) {
          options7.filename = 'sample.js';
        }
        if (usePresets) {
          options7.presets = presetsFor(7);
        }
        return transform7(code, options7)!.code!;
      });
    });
  }

  if (params.includePresetsTests) {
    _describe('with presets', function() {
      versions(true);
    });
    _describe('without presets', function() {
      versions(false);
    });
  } else {
    versions(false);
  }
}

export function emberTemplateCompilerPath() {
  return join(__dirname, 'vendor', 'ember-template-compiler.js');
}

export function definesPattern(runtimeName: string, buildTimeName: string): RegExp {
  runtimeName = escapeRegExp(runtimeName);
  buildTimeName = escapeRegExp(buildTimeName);
  return new RegExp(
    `d\\(['"]${runtimeName}['"], *function *\\(\\) *\\{[\\s\\n]*return require\\(['"]${buildTimeName}['"]\\);?[\\s\\n]*\\}\\)`
  );
}

export { Project } from './project';
export { default as BuildResult } from './build';
export { installFileAssertions } from './file-assertions';
