import 'qunit';
import { transform as transform6, TransformOptions as Options6 } from 'babel-core';
import { transform as transform7, TransformOptions as Options7 } from '@babel/core';

const { test } = QUnit;

function createTests(transform: (code: string) => string, babelVersion: number) {
  QUnit.module(`modulePresent (babel ${babelVersion})`, function() {
    test('hello', function(assert) {
      assert.equal(transform(`console.log('hello');`), `console.log('hello');`);
    });
  });
}

const options7: Options7 = {
  presets: [],
  plugins: []
};

const options6: Options6 = {
  presets: [],
  plugins: []
};

createTests(function(code: string){ return transform6(code, options6).code!; }, 6);
createTests(function(code: string){ return transform7(code, options7)!.code!; }, 7);
