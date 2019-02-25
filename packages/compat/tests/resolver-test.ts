import 'qunit';
import Resolver from '../src/resolver';
import { removeSync, mkdtempSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { join, dirname } from 'path';
import { optionsWithDefaults } from '../src/options';

const { test } = QUnit;

QUnit.module('resolver', function(hooks) {
  let appDir: string;

  hooks.beforeEach(function() {
    appDir = mkdtempSync('embroider-compat-resolver-tests');
  });

  hooks.afterEach(function() {
    removeSync(appDir);
  });

  function givenFiles(...files: string[]) {
    for (let file of files) {
      let target = join(appDir, file);
      ensureDirSync(dirname(target));
      writeFileSync(target, '');
    }
  }

  test('it works', function(assert) {
    givenFiles('components/hello-world.js');
    let resolver = new Resolver({
      root: appDir,
      modulePrefix: 'the-app',
      options: optionsWithDefaults({ staticComponents: true })
    });
    let resolution = resolver.resolveMustache('hello-world', join(appDir, 'templates', 'application.hbs'));
    assert.ok(resolution, 'expcted to resolve');
    if (resolution) {
      assert.equal(resolution.type, 'component');
      assert.deepEqual(resolution.modules, [{ path: '../components/hello-world.js', runtimeName: 'the-app/components/hello-world' }]);
    }
  });
});
