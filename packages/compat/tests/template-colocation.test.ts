import { Project, BuildResult, ExpectFile, expectFilesAt } from '@embroider/test-support';

import { throwOnWarnings } from '@embroider/core';
import Options from '../src/options';
import merge from 'lodash/merge';

describe('template colocation', function () {
  jest.setTimeout(120000);
  let expectFile: ExpectFile;
  let build: BuildResult;
  let app: Project;

  throwOnWarnings();

  beforeAll(async function () {
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

    let addon = app.addAddon('my-addon');
    merge(addon.files, {
      app: {
        components: {
          'component-one.js': `export { default } from 'my-addon/components/component-one';`,
        },
      },
      addon: {
        components: {
          'component-one.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
          `,
          'component-one.hbs': `component one template`,
          'component-two.hbs': `component two templates`,
        },
      },
    });

    let options: Options = {
      // our tests are going to check for how the components get implicitly
      // included, so this must be false.
      staticComponents: false,
    };

    build = await BuildResult.build(app, {
      stage: 2,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
      embroiderOptions: options,
    });
    expectFile = expectFilesAt(build.outputPath);
  });

  afterAll(async function () {
    await build.cleanup();
  });

  test(`app's colocated template is associated with JS`, function () {
    let assertFile = expectFile('components/has-colocated-template.js').transform(build.transpile);
    assertFile.matches(/import TEMPLATE from ['"]\.\/has-colocated-template.hbs['"];/, 'imported template');
    assertFile.matches(
      /export default Ember._setComponentTemplate\(TEMPLATE, class extends Component \{\}/,
      'default export is wrapped'
    );
  });

  test(`app's template-only component JS is synthesized`, function () {
    let assertFile = expectFile('components/template-only-component.js').transform(build.transpile);
    assertFile.matches(/import TEMPLATE from ['"]\.\/template-only-component.hbs['"];/, 'imported template');
    assertFile.matches(
      /export default Ember._setComponentTemplate\(TEMPLATE, Ember._templateOnlyComponent\(\)\)/,
      'default export is wrapped'
    );
  });

  test(`app's colocated components are implicitly included correctly`, function () {
    let assertFile = expectFile('assets/my-app.js');
    assertFile.matches(
      /d\(["']my-app\/components\/has-colocated-template["'], function\(\)\s*\{\s*return i\(["']\.\.\/components\/has-colocated-template['"]\);\s*\}/
    );
    assertFile.matches(
      /d\(["']my-app\/components\/template-only-component["'], function\(\)\s*\{\s*return i\(["']\.\.\/components\/template-only-component['"]\);\s*\}/
    );
  });

  test(`addon's colocated template is associated with JS`, function () {
    let assertFile = expectFile('node_modules/my-addon/components/component-one.js').transform(build.transpile);
    assertFile.matches(/import TEMPLATE from ['"]\.\/component-one.hbs['"];/, 'imported template');
    assertFile.matches(
      /export default Ember._setComponentTemplate\(TEMPLATE, class extends Component \{\}/,
      'default export is wrapped'
    );
  });

  test(`addon's template-only component JS is synthesized`, function () {
    let assertFile = expectFile('node_modules/my-addon/components/component-two.js').transform(build.transpile);
    assertFile.matches(/import TEMPLATE from ['"]\.\/component-two.hbs['"];/, 'imported template');
    assertFile.matches(
      /export default Ember._setComponentTemplate\(TEMPLATE, Ember._templateOnlyComponent\(\)\)/,
      'default export is wrapped'
    );
  });

  test(`addon's colocated components are correct in implicit-modules`, function () {
    let assertFile = expectFile('node_modules/my-addon/package.json').json();
    assertFile.get(['ember-addon', 'implicit-modules']).includes('./components/component-one');
    assertFile.get(['ember-addon', 'implicit-modules']).includes('./components/component-two');
    assertFile.get(['ember-addon', 'implicit-modules']).doesNotInclude('./components/component-one.hbs');
    assertFile.get(['ember-addon', 'implicit-modules']).doesNotInclude('./components/component-two.hbs');
  });
});

describe('template colocation with staticComponents', function () {
  jest.setTimeout(120000);
  let expectFile: ExpectFile;
  let build: BuildResult;
  let app: Project;

  throwOnWarnings();

  beforeAll(async function () {
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

    let addon = app.addAddon('my-addon');
    merge(addon.files, {
      app: {
        components: {
          'component-one.js': `export { default } from 'my-addon/components/component-one';`,
        },
      },
      addon: {
        components: {
          'component-one.js': `
            import Component from '@glimmer/component';
            export default class extends Component {}
          `,
          'component-one.hbs': `component one template`,
          'component-two.hbs': `component two templates`,
        },
      },
    });

    let options: Options = {
      staticComponents: true,
      staticAddonTrees: true,
    };

    build = await BuildResult.build(app, {
      stage: 2,
      type: 'app',
      emberAppOptions: {
        tests: false,
      },
      embroiderOptions: options,
    });
    expectFile = expectFilesAt(build.outputPath);
  });

  afterAll(async function () {
    await build.cleanup();
  });

  test(`app's colocated components are not implicitly included`, function () {
    let assertFile = expectFile('assets/my-app.js');
    assertFile.doesNotMatch(
      /d\(["']my-app\/components\/has-colocated-template["'], function\(\)\s*\{\s*return i\(["']\.\.\/components\/has-colocated-template['"]\);\s*\}/
    );
    assertFile.doesNotMatch(
      /d\(["']my-app\/components\/template-only-component["'], function\(\)\s*\{\s*return i\(["']\.\.\/components\/template-only-component['"]\);\s*\}/
    );
  });

  test(`addon's colocated components are not in implicit-modules`, function () {
    let assertFile = expectFile('node_modules/my-addon/package.json').json();
    assertFile.get(['ember-addon', 'implicit-modules']).equals(undefined);
  });
});
