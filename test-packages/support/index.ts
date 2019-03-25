import Project from 'ember-cli/lib/models/project';
import EmberApp from 'ember-cli/lib/broccoli/ember-app';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import MockUI from 'console-ui/mock';
import Instrumentation from 'ember-cli/lib/models/instrumentation';
import PackageInfoCache from 'ember-cli/lib/models/package-info-cache';
import 'qunit';
import 'jest';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';

class MockCLI {
  ui: any;
  root: string;
  npmPackage: string;
  instrumentation: Instrumentation;
  packageInfoCache: PackageInfoCache;
  constructor(options?: any) {
    options = options || {};

    this.ui = options.ui || new MockUI();
    this.root = join(__dirname, '..', '..');
    this.npmPackage = options.npmPackage || 'ember-cli';
    this.instrumentation = options.instrumentation || new Instrumentation({});
    this.packageInfoCache = new PackageInfoCache(this.ui);
  }
}

export function emberApp(dir: string, userOpts: any = {}): any {
  let cli = new MockCLI();
  let project = new Project(dir, readJSONSync(join(dir, 'package.json')), cli.ui, cli);
  return new EmberApp({ project }, userOpts);
}

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
