import type { ExpectFile } from '@embroider/test-support/file-assertions/qunit';
import { expectFilesAt } from '@embroider/test-support/file-assertions/qunit';
import { appScenarios } from './scenarios';
import QUnit from 'qunit';
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
        let result = await app.execute('ember build');
        assert.equal(result.exitCode, 0, result.output);
        expectFile = expectFilesAt(app.dir, { qunit: assert });
      });

      test('custom HTML attributes are passed through', () => {
        expectFile('./dist/index.html').matches('<link integrity="" rel="stylesheet prefetch"');
        expectFile('./dist/index.html').doesNotMatch('rel="stylesheet"');
        expectFile('./dist/index.html').matches('<script defer');
        expectFile('./dist/index.html').doesNotMatch('<script src');
        // by default, there is no vendor CSS and the tag is omitted entirely
        expectFile('./dist/index.html').doesNotMatch('data-original-filename="vendor.css">');
        expectFile('./dist/index.html').matches('" data-original-filename="app-template.css">');
        expectFile('./dist/index.html').matches('" data-original-filename="vendor.js">');
        expectFile('./dist/index.html').matches('" data-original-filename="app-template.js">');
      });
    });
  });
