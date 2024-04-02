import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { appScenarios } from './scenarios';
import QUnit from 'qunit';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

appScenarios
  .map('compat-app-script-attributes', app => {
    let appFolder = app.files.app;

    if (appFolder === null || typeof appFolder !== 'object') {
      throw new Error('app folder unexpectedly missing');
    }

    let indexHtml = appFolder['index.html'];

    if (typeof indexHtml !== 'string') {
      throw new Error('index.html unexpectedly missing');
    }

    // <link ... href=".../app-template.css"> => <link ... href=".../app-template.css" data-original-filename="app-template.css">
    indexHtml = indexHtml.replace('vendor.css">', 'vendor.css" data-original-filename="vendor.css">');
    indexHtml = indexHtml.replace('app-template.css">', 'app-template.css" data-original-filename="app-template.css">');

    // <link integrity="" rel="stylesheet" => <link integrity="" rel="stylesheet prefetch"
    indexHtml = indexHtml.replace(
      /<link integrity="" rel="stylesheet"/g,
      '<link integrity="" rel="stylesheet prefetch"'
    );

    // <script ... src=".../vendor.js"> => <script ... src=".../vendor.js" data-original-filename="vendor.js">
    indexHtml = indexHtml.replace('vendor.js">', 'vendor.js" data-original-filename="vendor.js">');
    indexHtml = indexHtml.replace('app-template.js">', 'app-template.js" data-original-filename="app-template.js">');

    // <script ... => <script defer ...
    indexHtml = indexHtml.replace(/<script /g, '<script defer ');

    app.mergeFiles({
      app: {
        'index.html': indexHtml,
      },
    });
  })
  .forEachScenario(scenario => {
    let expectFile: ExpectFile;

    Qmodule(scenario.name, function (hooks) {
      hooks.beforeEach(async assert => {
        let app = await scenario.prepare();
        let result = await app.execute('ember build', { env: { EMBROIDER_PREBUILD: 'true' } });
        assert.equal(result.exitCode, 0, result.output);
        expectFile = expectFilesAt(join(app.dir, 'node_modules', '.embroider', 'rewritten-app'), { qunit: assert });
      });

      test('custom HTML attributes are passed through', () => {
        expectFile('./index.html').matches('<link integrity="" rel="stylesheet prefetch"', 'has the prefetch script');
        expectFile('./index.html').doesNotMatch('rel="stylesheet"', 'does not have rel=stylesheet');
        expectFile('./index.html').matches('<script defer', 'has script defer');
        expectFile('./index.html').doesNotMatch('<script src', 'does not have script src');
        expectFile('./index.html').doesNotMatch(
          'data-original-filename="vendor.css">',
          'does not have data-original-filename vendor.css'
        );
        expectFile('./index.html').matches(
          '" data-original-filename="app-template.css">',
          'has data-original-filename app-template.css'
        );
        expectFile('./index.html').matches(
          '" data-original-filename="vendor.js">',
          'has data-original-filename vendor.js'
        );
        expectFile('./index.html').matches(
          '" data-original-filename="app-template.js" type="module">',
          'has data-original-filename app-template.js'
        );
      });
    });
  });
