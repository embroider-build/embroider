import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { reflectAddonConfig } from 'app-template/helpers/reflect-addon-config';
import { precompileTemplate } from "@ember/template-compilation";

module('Integration | cross-package-config', function (hooks) {
  setupRenderingTest(hooks);

  test(`addon's JS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual(value, {
        shouldBeOverwritten: 'overwritten',
        configFromAddonItself: 'this is the addon',
        configFromMacrosTests: 'exists',
      });
    }
    await render(precompileTemplate('{{myAssertion (reflect-config)}}', {
      scope: () => ({ myAssertion })
    }));
  });

  test(`app's JS can see addon's merged config`, async function (assert) {
    assert.deepEqual(reflectAddonConfig(), {
      shouldBeOverwritten: 'overwritten',
      configFromAddonItself: 'this is the addon',
      configFromMacrosTests: 'exists',
    });
  });

  test(`addon's HBS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual(value, {
        shouldBeOverwritten: 'overwritten',
        configFromAddonItself: 'this is the addon',
        configFromMacrosTests: 'exists',
      });
    }
    await render(precompileTemplate(`{{#reflect-hbs-config as |config|}} {{myAssertion config}} {{/reflect-hbs-config}}`, {
      scope: () => ({ myAssertion })
    }));
  });

  test(`app's HBS can see addon's merged config`, async function (assert) {
    assert.expect(1);
    function myAssertion(value) {
      assert.deepEqual(value, {
        shouldBeOverwritten: 'overwritten',
        configFromAddonItself: 'this is the addon',
        configFromMacrosTests: 'exists',
      });
    }
    await render(precompileTemplate(`{{myAssertion (macroGetConfig "macro-sample-addon" )}}`, {
      scope: () => ({ myAssertion })
    }));
  });
});
