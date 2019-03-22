import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { getOwnConfig } from '@embroider/macros';

/* global requirejs */

module('Acceptance | lazy routes', function(hooks) {
  setupApplicationTest(hooks);

  function hasController(routeName) {
    return Boolean(requirejs.entries[`static-app/controllers/${routeName}`]);
  }

  function hasRoute(routeName) {
    return Boolean(requirejs.entries[`static-app/routes/${routeName}`]);
  }

  function hasTemplate(routeName) {
    return Boolean(requirejs.entries[`static-app/templates/${routeName}`]);
  }

  function hasComponentTemplate(name) {
    return Boolean(requirejs.entries[`static-app/templates/components/${name}`]);
  }

  test('lazy routes initially not present', async function(assert) {
    await visit('/');
    if (getOwnConfig().isClassic) {
      assert.ok(hasController('split-me'), 'classic build has controller');
      assert.ok(hasRoute('split-me'), 'classic build has route');
      assert.ok(hasTemplate('split-me'), 'classic build has template');
      assert.ok(hasController('split-me/child'), 'classic build has child controller');
      assert.ok(hasRoute('split-me/child'), 'classic build has child route');
      assert.ok(hasTemplate('split-me/child'), 'classic build has child template');
      assert.ok(hasComponentTemplate('used-in-child'), 'classic build has all components');
    } else {
      assert.ok(!hasController('split-me'), 'controller is lazy');
      assert.ok(!hasRoute('split-me'), 'route is lazy');
      assert.ok(!hasTemplate('split-me'), 'template is lazy');
      assert.ok(!hasController('split-me/child'), 'child controller is lazy');
      assert.ok(!hasRoute('split-me/child'), 'child route is lazy');
      assert.ok(!hasTemplate('split-me/child'), 'child template is lazy');
      assert.ok(!hasComponentTemplate('used-in-child'), 'descendant components are lazy');
    }
  });

  test('can enter a lazy route', async function(assert) {
    // TODO: next we'll make this route loading automatic
    /* global _embroiderRoute_ */
    await _embroiderRoute_('split-me');
    await visit('/split-me');
    assert.ok(document.querySelector('[data-test-split-me-index]'), 'split-me/index rendered');
  });

  test('can enter a child of a lazy route', async function(assert) {
    /* global _embroiderRoute_ */
    await _embroiderRoute_('split-me.child');
    await visit('/split-me/child');
    assert.ok(document.querySelector('[data-test-used-in-child]'), 'split-me/child rendered');
  });
});
