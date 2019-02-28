import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { helper } from '@ember/component/helper';
import { reflectAddonConfig } from 'macro-tests/helpers/reflect-addon-config';

module('Integration | cross-package-config', function(hooks) {
  setupRenderingTest(hooks);

  test(`addon's JS can see addon's merged config`, async function(assert) {
    assert.expect(1);
    this.owner.register('helper:my-assertion', helper(function([value]) {
      assert.deepEqual(value, { hello: 'world', configFromMacrosTests: 'exists' });
    }));
    await render(hbs`{{my-assertion (reflect-config)}}`);
  });

  test(`app's JS can see addon's merged config`, async function(assert) {
    assert.deepEqual(reflectAddonConfig(), { hello: 'world', configFromMacrosTests: 'exists' });
  });

});
