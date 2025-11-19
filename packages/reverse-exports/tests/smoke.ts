import { externalName } from '../src';
import assert from 'node:assert';

const actual = externalName(
  {
    name: 'my-addon',
    version: '1.1.0',
    exports: {
      './*': './dist/*.js',
    },
  },
  './dist/foo.js'
);
assert.strictEqual(actual, 'my-addon/foo');
