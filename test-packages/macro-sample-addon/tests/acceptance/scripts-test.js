import { module, test } from 'qunit';

module('Acceptance | scripts', function() {
  test('ensure all scripts in index.html 200', async function(assert) {
    for (let { src } of document.scripts) {
      let { status } = await fetch(src);
      assert.equal(status, 200, `expected: '${src}' to be accessible`);
    }
  });
});
