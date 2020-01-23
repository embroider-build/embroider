import 'qunit';
import { Project, BuildResult, installFileAssertions } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import Options from '../src/options';
import merge from 'lodash/merge';

QUnit.module('template resolution', function(origHooks) {
  let { hooks, test } = installFileAssertions(origHooks);
  let build: BuildResult;
  let app: Project;

  throwOnWarnings(hooks);

  hooks.before(async function(assert) {
    app = Project.emberNew();

    merge(app.files, {
      config: {
        'targets.js': `module.exports = { browsers: ['last 1 Chrome versions'] }`,
      },
      app: {
        templates: {
          'index.hbs': `
              <HasColocatedTemplate />
              <TemplateOnlyComponent />
            `,
        },
        components: {
          'has-colocated-template.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
            `,
          'has-colocated-template.hbs': `<div>{{this.title}}</div>`,
          'template-only-component.hbs': `<div>I am template only</div>`,
        },
      },
    });

    let options: Options = {
      staticComponents: true,
      staticHelpers: true,
    };

    build = await BuildResult.build(app, {
      stage: 2,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
      embroiderOptions: options,
    });
    assert.basePath = build.outputPath;
  });

  hooks.after(async function() {
    await build.cleanup();
  });

  test('has-colocated-template', function(assert) {
    let assertFile = assert.file('components/has-colocated-template.js').transform(build.transpile);
    assertFile.matches(/import { TEMPLATE } from ['"]\.\/has-colocated-template.hbs['"];/, 'imported template');
    assertFile.matches(
      /export default Ember._setComponentTemplate\(TEMPLATE, class extends Component \{\}/,
      'default export is wrapped'
    );
  });
});
