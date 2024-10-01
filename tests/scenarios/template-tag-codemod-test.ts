import { readFileSync } from 'fs-extra';
import { appScenarios } from './scenarios';
import QUnit from 'qunit';
import { join } from 'path';

const { module: Qmodule, test } = QUnit;

appScenarios
  .only('release')
  .map('template-tag-codemod', project => {
    project.mergeFiles({
      app: {
        components: {
          'face.hbs': `<h1> this is a gjs file</h1>`,
        },
      },
      'ember-cli-build.js': `'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    // Add options here
  });
  return require('@embroider/compat').templateTagCodemod(app, {});
};`,
    });
  })
  .forEachScenario(async scenario => {
    Qmodule(`${scenario.name}`, function (/* hooks */) {
      test('running the codemod works', async function (assert) {
        let app = await scenario.prepare();
        await app.execute('node ./node_modules/ember-cli/bin/ember b');

        // TODO figure out how to get assert.codeContains to understand template tag
        const fileContents = readFileSync(join(app.dir, 'app/components/face.gjs'), 'utf-8');
        assert.equal(
          fileContents,
          `

export default <template>
	<h1> this is a gjs file</h1>
</template>;`
        );
        // TODO figure out how to get around the protection in place to not delete unversioned files
        //  we do git rm for the very reason we avoid possible destructive operations
        // assert.ok(!existsSync(join(app.dir, 'app/components/face.hbs')), 'template only component gets deleted');
      });
    });
  });
