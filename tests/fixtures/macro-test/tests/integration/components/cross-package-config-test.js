import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';
import { reflectAddonConfig } from 'app-template/helpers/reflect-addon-config';

module('Integration | cross-package-config', function (hooks) {
  setupRenderingTest(hooks);

  test(`addon's JS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.deepEqual(value, {
          shouldBeOverwritten: 'overwritten',
          configFromAddonItself: 'this is the addon',
          configFromMacrosTests: 'exists',
          configFromConfigFile: 'got it',
        });
      })
    );
    await render(hbs`{{my-assertion (reflect-config)}}`);
  });

  test(`app's JS can see addon's merged config`, async function (assert) {
    assert.deepEqual(reflectAddonConfig(), {
      shouldBeOverwritten: 'overwritten',
      configFromAddonItself: 'this is the addon',
      configFromMacrosTests: 'exists',
      configFromConfigFile: 'got it',
    });
  });

  test(`addon's HBS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.deepEqual(value, {
          shouldBeOverwritten: 'overwritten',
          configFromAddonItself: 'this is the addon',
          configFromMacrosTests: 'exists',
          configFromConfigFile: 'got it',
        });
      })
    );
    await render(hbs`{{#reflect-hbs-config as |config|}} {{my-assertion config}} {{/reflect-hbs-config}}`);
  });

  test(`app's HBS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    this.owner.register(
      'helper:my-assertion',
      helper(function ([value]) {
        assert.deepEqual(value, {
          shouldBeOverwritten: 'overwritten',
          configFromAddonItself: 'this is the addon',
          configFromMacrosTests: 'exists',
          configFromConfigFile: 'got it',
        });
      })
    );
    await render(hbs`{{my-assertion (macroGetConfig "macro-sample-addon" )}}`);
  });
});
