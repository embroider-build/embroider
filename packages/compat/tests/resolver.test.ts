import {
  removeSync,
  mkdtempSync,
  writeFileSync,
  ensureDirSync,
  writeJSONSync,
  realpathSync,
  outputJSONSync,
} from 'fs-extra';
import { join, dirname } from 'path';
import Options, { optionsWithDefaults } from '../src/options';
import { hbsToJS, tmpdir, throwOnWarnings, ResolverOptions, AddonMeta } from '@embroider/core';
import { emberTemplateCompiler } from '@embroider/test-support';
import { CompatResolverOptions } from '../src/resolver-transform';
import { PackageRules } from '../src';
import type { AST, ASTPluginEnvironment } from '@glimmer/syntax';
import 'code-equality-assertions/jest';
import type { Transform, Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { TransformOptions, transformSync } from '@babel/core';
import type { Options as ResolverTransformOptions } from '../src/resolver-transform';

describe('compat-resolver', function () {
  let appDir: string;

  function addonPackageJSON(name: string) {
    let meta: AddonMeta = { type: 'addon', version: 2, 'auto-upgraded': true };
    return {
      name,
      keywords: ['ember-addon'],
      'ember-addon': meta,
    };
  }

  function configure(
    compatOptions: Options,
    otherOptions: {
      podModulePrefix?: string;
      adjustImportsImports?: Partial<ResolverOptions>;
      plugins?: Transform[];
      startingFrom?: 'hbs' | 'js';
    } = {}
  ) {
    appDir = realpathSync(mkdtempSync(join(tmpdir, 'embroider-compat-tests-')));
    writeJSONSync(join(appDir, 'package.json'), {
      name: 'the-app',
      keywords: ['ember-addon'],
      'ember-addon': { type: 'app', version: 2, 'auto-upgraded': true },
    });
    let resolverConfig: CompatResolverOptions = {
      appRoot: appDir,
      modulePrefix: 'the-app',
      podModulePrefix: otherOptions.podModulePrefix,
      options: optionsWithDefaults(compatOptions),
      activePackageRules: optionsWithDefaults(compatOptions).packageRules.map(rule => {
        let root = rule.package === 'the-test-package' ? appDir : `${appDir}/node_modules/${rule.package}`;
        return Object.assign({ roots: [root] }, rule);
      }),
      renamePackages: {},
      renameModules: {},
      extraImports: {},
      activeAddons: {},
      engines: [
        {
          packageName: 'the-app',
          root: appDir,
          activeAddons: [
            {
              name: 'my-addon',
              root: join(appDir, 'node_modules', 'my-addon'),
            },
          ],
        },
      ],
      relocatedFiles: {},
      resolvableExtensions: ['.js', '.hbs'],
      ...otherOptions.adjustImportsImports,
    };

    let transforms: Transform[] = [];

    let transformOpts: ResolverTransformOptions = {
      appRoot: resolverConfig.appRoot,
    };
    let resolverTransform: Transform = [require.resolve('../src/resolver-transform'), transformOpts];

    if (otherOptions.plugins) {
      transforms.push.apply(transforms, otherOptions.plugins);
    }
    if (resolverTransform) {
      transforms.push(resolverTransform);
    }
    let etcOptions: EtcOptions = {
      compilerPath: emberTemplateCompiler().path,
      transforms,
      targetFormat: 'hbs',
    };
    let babelConfig: TransformOptions = {
      plugins: [[require.resolve('babel-plugin-ember-template-compilation'), etcOptions]],
    };

    outputJSONSync(join(appDir, '.embroider', 'resolver.json'), resolverConfig);
    outputJSONSync(join(appDir, 'node_modules/my-addon/package.json'), addonPackageJSON('my-addon'));

    return function (relativePath: string, contents: string) {
      let jsInput =
        otherOptions?.startingFrom === 'js' ? contents : hbsToJS(contents, { filename: `my-app/${relativePath}` });
      let moduleName = givenFile(relativePath);
      return transformSync(jsInput, { ...babelConfig, filename: moduleName })!.code!;
    };
  }

  throwOnWarnings();

  afterEach(function () {
    if (appDir) {
      removeSync(appDir);
    }
  });

  function givenFile(filename: string, containing = '') {
    let target = join(appDir, filename);
    ensureDirSync(dirname(target));
    writeFileSync(target, containing);
    return target;
  }

  test('dynamic component helper error in content position', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(() => {
      transform('templates/application.hbs', `{{component this.which}}`);
    }).toThrow(/Unsafe dynamic component: this\.which in templates\/application\.hbs/);
  });

  test('angle component, js and hbs', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    expect(transform('templates/application.hbs', `<HelloWorld />`)).toEqualCode(`
      import helloWorld0 from "../components/hello-world.js";
      import helloWorld from "./components/hello-world.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/hello-world", () => helloWorld);
      window.define("the-app/components/hello-world", () => helloWorld0);
      export default precompileTemplate("<HelloWorld />", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('nested angle component, js and hbs', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/something/hello-world.js');
    givenFile('templates/components/something/hello-world.hbs');
    expect(transform('templates/application.hbs', `<Something::HelloWorld />`)).toEqualCode(`
      import helloWorld0 from "../components/something/hello-world.js";
      import helloWorld from "./components/something/hello-world.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/something/hello-world", () => helloWorld);
      window.define("the-app/components/something/hello-world", () => helloWorld0);
      export default precompileTemplate("<Something::HelloWorld />", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('angle component missing', function () {
    let transform = configure({ staticComponents: true });
    expect(() => {
      transform('templates/application.hbs', `<HelloWorld />`);
    }).toThrow(new RegExp(`Missing component: HelloWorld in templates/application.hbs`));
  });
  test('helper in subexpression', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    expect(transform('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`)).toEqualCode(`
      import array from "../helpers/array.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate(
        "{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}",
        {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            array,
          }),
        }
      );
    `);
  });
  test('missing subexpression with args', function () {
    let transform = configure({ staticHelpers: true });
    expect(() => {
      transform('templates/application.hbs', `{{#each (things 1 2 3) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test('missing subexpression no args', function () {
    let transform = configure({ staticHelpers: true });
    expect(() => {
      transform('templates/application.hbs', `{{#each (things) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test('emits no helpers when staticHelpers is off', function () {
    let transform = configure({ staticHelpers: false });
    givenFile('helpers/array.js');
    expect(transform('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('helper as component argument', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    expect(transform('templates/application.hbs', `{{my-component value=(array 1 2 3) }}`)).toEqualCode(`
      import array from "../helpers/array.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{my-component value=(array 1 2 3)}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          array
        })
      });
    `);
  });
  test('helper as html attribute', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(transform('templates/application.hbs', `<div data-foo={{capitalize name}}></div>`)).toEqualCode(`
      import capitalize from "../helpers/capitalize.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<div data-foo={{capitalize name}}></div>", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          capitalize
        })
      });
    `);
  });
  test('helper in bare mustache, no args', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(transform('templates/application.hbs', `{{capitalize name}}`)).toEqualCode(`
      import capitalize from "../helpers/capitalize.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{capitalize name}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          capitalize
        }),
      });
    `);
  });
  test('helper in bare mustache, with args', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(transform('templates/application.hbs', `{{capitalize name}}`)).toEqualCode(`
      import capitalize from "../helpers/capitalize.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{capitalize name}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          capitalize
        }),
      });
    `);
  });

  test('leaves strict mode templates alone', function () {
    let transform = configure({ staticComponents: true }, { startingFrom: 'js' });
    // strict mode templates don't need our resolver transform at all, because
    // they don't do any global resolution.

    // this test deliberately contains a runtime error. we're checking that it
    // doesn't become a build-time error in our transform (which it would be if
    // our transform tried to resolve Thing).
    expect(
      transform(
        'components/example.js',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          export default precompileTemplate("<Thing />", {
            strict: true,
          });
        `
      )
    ).toEqualCode(`
      import { precompileTemplate } from '@ember/template-compilation';
      export default precompileTemplate("<Thing />", {
        strict: true,
      });
    `);
  });

  test('respects lexically scoped component', function () {
    let transform = configure({ staticComponents: true }, { startingFrom: 'js' });
    expect(
      transform(
        'components/example.js',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          import Thing from 'whatever';
          precompileTemplate("<Thing />", {
            scope: () => ({ Thing }),
          });
        `
      )
    ).toEqualCode(`
      import { precompileTemplate } from '@ember/template-compilation';
      import Thing from 'whatever';
      precompileTemplate("<Thing />", {
        scope: () => ({ Thing }),
      });
    `);
  });

  test('respects lexically scoped helper', function () {
    let transform = configure({ staticComponents: true, staticHelpers: true }, { startingFrom: 'js' });
    expect(
      transform(
        'components/example.js',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          import thing from 'whatever';
          precompileTemplate("<div class={{thing flavor=1}}></div>", {
            scope: () => ({ thing }),
          });
        `
      )
    ).toEqualCode(`
      import { precompileTemplate } from '@ember/template-compilation';
      import thing from 'whatever';
      precompileTemplate("<div class={{thing flavor=1}}></div>", {
        scope: () => ({ thing }),
      });
    `);
  });

  test('missing modifier', function () {
    let transform = configure({ staticModifiers: true });
    expect(() => {
      transform('templates/application.hbs', `<canvas {{fancy-drawing}}></canvas>`);
    }).toThrow(new RegExp(`Missing modifier: fancy-drawing in templates/application.hbs`));
  });
  test('emits no modifiers when staticModifiers is off', function () {
    let transform = configure({ staticModifiers: false });
    givenFile('modifiers/auto-focus.js');
    expect(transform('templates/application.hbs', `<input {{auto-focus}} />`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<input {{auto-focus}} />", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('modifier on html element', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(transform('templates/application.hbs', `<input {{auto-focus}} />`)).toEqualCode(`
      import autoFocus from "../modifiers/auto-focus.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<input {{autoFocus}} />", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          autoFocus,
        }),
      });
    `);
  });

  test('modifier on component', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(transform('templates/application.hbs', `<StyledInput {{auto-focus}} />`)).toEqualCode(`
      import autoFocus from "../modifiers/auto-focus.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<StyledInput {{autoFocus}} />", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          autoFocus
        })
      });
    `);
  });
  test('modifier on contextual component', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(transform('templates/application.hbs', `<Form as |f|> <f.Input {{auto-focus}} /></Form>`)).toEqualCode(`
      import autoFocus from "../modifiers/auto-focus.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<Form as |f|> <f.Input {{autoFocus}} /></Form>", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          autoFocus
        })
      });
    `);
  });
  test('modifier provided as an argument', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(transform('components/test.hbs', `<input {{@auto-focus}} />`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<input {{@auto-focus}} />", {
        moduleName: "my-app/components/test.hbs"
      });
    `);
  });
  test('contextual modifier', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(transform('templates/application.hbs', `<Form as |f|> <input {{f.auto-focus}} /></Form>`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<Form as |f|> <input {{f.auto-focus}} /></Form>", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('local binding takes precedence over helper in bare mustache', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(transform('templates/application.hbs', `{{#each things as |capitalize|}} {{capitalize}} {{/each}}`))
      .toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#each things as |capitalize|}} {{capitalize}} {{/each}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('local binding takes precedence over component in element position', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('components/the-thing.js');
    expect(transform('templates/application.hbs', `{{#each things as |TheThing|}} <TheThing /> {{/each}}`))
      .toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#each things as |TheThing|}} <TheThing /> {{/each}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('local binding takes precedence over modifier', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/some-modifier.js');
    expect(
      transform(
        'templates/application.hbs',
        `{{#each modifiers as |some-modifier|}} <div {{some-modifier}}></div> {{/each}}`
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#each modifiers as |some-modifier|}} <div {{some-modifier}}></div> {{/each}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('angle components can establish local bindings', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(transform('templates/application.hbs', `<Outer as |capitalize|> {{capitalize}} </Outer>`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<Outer as |capitalize|> {{capitalize}} </Outer>", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('local binding only applies within block', function () {
    let transform = configure({ staticHelpers: true, staticModifiers: true });
    givenFile('helpers/capitalize.js');
    givenFile('modifiers/validate.js');
    expect(
      transform(
        'templates/application.hbs',
        `
        {{#each things as |capitalize|}} {{capitalize}} {{/each}} {{capitalize}}
        <Form as |validate|><input {{validate}} /></Form> <input {{validate}} />
        `
      )
    ).toEqualCode(`
      import validate from "../modifiers/validate.js";
      import capitalize from "../helpers/capitalize.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{#each things as |capitalize|}} {{capitalize}} {{/each}} {{capitalize}}\\n        <Form as |validate|><input {{validate}} /></Form> <input {{validate}} />\\n        ", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          capitalize,
          validate
        })
      });
    `);
  });
  test('ignores builtins', function () {
    let transform = configure({ staticHelpers: true, staticComponents: true, staticModifiers: true });
    expect(
      transform(
        'templates/application.hbs',
        `
        {{outlet}}
        {{yield bar}}
        {{#with (hash submit=(action doit)) as |thing| }}
        {{/with}}
        <LinkTo @route="index"/>
        <form {{on "submit" doit}}></form>
      `
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{outlet}}\\n        {{yield bar}}\\n        {{#with (hash submit=(action doit)) as |thing|}}\\n        {{/with}}\\n        <LinkTo @route=\\"index\\" />\\n        <form {{on \\"submit\\" doit}}></form>\\n      ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('ignores dot-rule curly component invocation, inline', function () {
    let transform = configure({ staticHelpers: true, staticComponents: true });
    expect(transform('templates/application.hbs', `{{thing.body x=1}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{thing.body x=1}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('ignores dot-rule curly component invocation, block', function () {
    let transform = configure({ staticHelpers: true, staticComponents: true });
    expect(
      transform(
        'templates/application.hbs',
        `
        {{#thing.body}}
        {{/thing.body}}
        `
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{#thing.body}}\\n        {{/thing.body}}\\n        ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('respects yieldsSafeComponents rule, position 0', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsSafeComponents: [true],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    transform(
      'templates/application.hbs',
      `
      {{#form-builder as |field| }}
        {{component field}}
      {{/form-builder}}
    `
    );
  });

  test('respects yieldsSafeComponents rule on element, position 0', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsSafeComponents: [true],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    transform(
      'templates/application.hbs',
      `
      <FormBuilder as |field| >
        {{component field}}
      </FormBuilder>
    `
    );
  });

  test('respects yieldsSafeComponents rule, position 1', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsSafeComponents: [false, true],
          },
        },
      },
    ];
    let transform = configure({
      staticComponents: true,
      packageRules,
    });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/application.hbs',
        `
        {{#form-builder as |other field| }}
          {{component field}}
        {{/form-builder}}
      `
      );
    }).not.toThrow();
    expect(() => {
      transform(
        'templates/application.hbs',
        `
        {{#form-builder as |other field| }}
          {{component other}}
        {{/form-builder}}
      `
      );
    }).toThrow(/Unsafe dynamic component: other in templates\/application\.hbs/);
  });

  test('respects yieldsSafeComponents rule, position 0.field', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsSafeComponents: [
              {
                field: true,
              },
            ],
          },
        },
      },
    ];
    let transform = configure({
      staticComponents: true,
      packageRules,
    });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/application.hbs',
        `
      {{#form-builder as |f| }}
        {{component f.field}}
      {{/form-builder}}
    `
      );
    }).not.toThrow();
    expect(() => {
      transform(
        'templates/application.hbs',
        `
        {{#form-builder as |f| }}
          {{component f.other}}
        {{/form-builder}}
      `
      );
    }).toThrow(/Unsafe dynamic component: f.other/);
  });

  test('respects yieldsSafeComponents rule, position 1.field', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsSafeComponents: [
              false,
              {
                field: true,
              },
            ],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/application.hbs',
        `
      {{#form-builder as |x f| }}
        {{component f.field}}
      {{/form-builder}}
    `
      );
    }).not.toThrow();
    expect(() => {
      transform(
        'templates/application.hbs',
        `
        {{#form-builder as |x f| }}
          {{component f.other}}
        {{/form-builder}}
    `
      );
    }).toThrow(/Unsafe dynamic component: f.other/);
  });

  test('acceptsComponentArguments on mustache with valid literal', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    givenFile('components/fancy-title.js');
    expect(transform('templates/application.hbs', `{{form-builder title="fancy-title"}}`)).toEqualCode(`
      import fancyTitle from "../components/fancy-title.js";
      import formBuilder from "../components/form-builder.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate('{{formBuilder title=fancyTitle}}', {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          formBuilder, fancyTitle
        }),
      });
    `);
    // expect(transform('templates/application.hbs', `{{form-builder title="fancy-title"}}`)).toEqual([
    //   {
    //     runtimeName: 'the-app/templates/components/fancy-title',
    //     path: './components/fancy-title.hbs',
    //   },
    //   {
    //     runtimeName: 'the-app/templates/components/form-builder',
    //     path: './components/form-builder.hbs',
    //   },
    // ]);
  });

  test('acceptsComponentArguments on mustache block with valid literal', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    givenFile('components/fancy-title.js');
    expect(transform('templates/application.hbs', `{{#form-builder title="fancy-title"}} {{/form-builder}}`))
      .toEqualCode(`
      import fancyTitle from "../components/fancy-title.js";
      import formBuilder from "../components/form-builder.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate(
        '{{#formBuilder title=fancyTitle}} {{/formBuilder}}',
        {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            formBuilder, fancyTitle
          }),
        }
      );
    `);
    // expect(transform('templates/application.hbs', `{{#form-builder title="fancy-title"}} {{/form-builder}}`)).toEqual([
    //   {
    //     runtimeName: 'the-app/templates/components/fancy-title',
    //     path: './components/fancy-title.hbs',
    //   },
    //   {
    //     runtimeName: 'the-app/templates/components/form-builder',
    //     path: './components/form-builder.hbs',
    //   },
    // ]);
  });

  test('acceptsComponentArguments argument name may include optional @', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['@title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(transform('templates/application.hbs', `{{form-builder title="fancy-title"}}`)).toEqualCode(`
      import fancyTitle from "./components/fancy-title.hbs";
      import formBuilder from "./components/form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      window.define("the-app/templates/components/fancy-title", () => fancyTitle);
      export default precompileTemplate("{{form-builder title=\\"fancy-title\\"}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('acceptsComponentArguments on mustache with component subexpression', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(transform('templates/application.hbs', `{{form-builder title=(component "fancy-title") }}`)).toEqualCode(`
      import fancyTitle from "./components/fancy-title.hbs";
      import formBuilder from "./components/form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      window.define("the-app/templates/components/fancy-title", () => fancyTitle);
      export default precompileTemplate("{{form-builder title=(component \\"fancy-title\\")}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('acceptsComponentArguments on element with component helper mustache', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    givenFile('components/fancy-title.js');
    expect(transform('templates/application.hbs', `<FormBuilder @title={{component "fancy-title"}} />`)).toEqualCode(`
      import fancyTitle from "../components/fancy-title.js";
      import FormBuilder from "../components/form-builder.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate(
        "<FormBuilder @title={{component fancyTitle}} />",
        {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            FormBuilder,
            fancyTitle,
          }),
        }
      );    
    `);
  });

  test('acceptsComponentArguments matches co-located template', function () {
    let packageRules = [
      {
        package: 'the-app',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    expect(transform('components/form-builder.hbs', `{{component title}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component title}}", {
        moduleName: "my-app/components/form-builder.hbs"
      });
    `);
  });

  test(`element block params are not in scope for element's own attributes`, function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
            yieldsSafeComponents: [true],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform('templates/application.hbs', `<FormBuilder @title={{title}} as |title|></FormBuilder>`);
    }).toThrow(
      /argument "title" to component "FormBuilder" is treated as a component, but the value you're passing is dynamic: title/
    );
  });

  test('acceptsComponentArguments on mustache with invalid literal', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform('templates/application.hbs', `{{form-builder title="fancy-title"}}`);
    }).toThrow(/Missing component: fancy-title in templates\/application\.hbs/);
  });

  test('acceptsComponentArguments on element with valid literal', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    givenFile('components/fancy-title.js');
    expect(transform('templates/application.hbs', `<FormBuilder @title={{"fancy-title"}} />`)).toEqualCode(`
      import fancyTitle from "../components/fancy-title.js";
      import FormBuilder from "../components/form-builder.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<FormBuilder @title={{fancyTitle}} />", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          FormBuilder,
          fancyTitle,
        }),
      });
    `);
  });

  test('acceptsComponentArguments on element with valid attribute', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    givenFile('components/fancy-title.js');
    expect(transform('templates/application.hbs', `<FormBuilder @title="fancy-title" />`)).toEqualCode(`
      import fancyTitle from "../components/fancy-title.js";
      import FormBuilder from "../components/form-builder.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<FormBuilder @title={{fancyTitle}} />", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          FormBuilder,
          fancyTitle,
        }),
      });
    `);
  });

  test('acceptsComponentArguments interior usage of path generates no warning', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    expect(transform('templates/components/form-builder.hbs', `{{component title}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component title}}", {
        moduleName: "my-app/templates/components/form-builder.hbs"
      });
    `);
  });

  test('acceptsComponentArguments interior usage of this.path generates no warning', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: [
              {
                name: 'title',
                becomes: 'this.title',
              },
            ],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    expect(transform('templates/components/form-builder.hbs', `{{component this.title}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component this.title}}", {
        moduleName: "my-app/templates/components/form-builder.hbs"
      });
    `);
  });

  test('acceptsComponentArguments interior usage of @path generates no warning', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            acceptsComponentArguments: ['@title'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    expect(transform('templates/components/form-builder.hbs', `{{component @title}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component @title}}", {
        moduleName: "my-app/templates/components/form-builder.hbs"
      });
    `);
  });

  test('safeToIgnore a missing component', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            safeToIgnore: true,
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    expect(transform('templates/components/x.hbs', `<FormBuilder />`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<FormBuilder />", {
        moduleName: "my-app/templates/components/x.hbs"
      });
    `);
  });

  test('safeToIgnore a present component', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            safeToIgnore: true,
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(transform('templates/components/x.hbs', `<FormBuilder />`)).toEqualCode(`
      import formBuilder from "./form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      export default precompileTemplate("<FormBuilder />", {
        moduleName: "my-app/templates/components/x.hbs"
      });
    `);
  });

  test('respects yieldsArguments rule for positional block param, angle', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: ['navbar'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      transform(
        'templates/components/x.hbs',
        `
        <FormBuilder @navbar={{component "fancy-navbar"}} as |bar|>
          {{component bar}}
        </FormBuilder>
        `
      )
    ).toEqualCode(`
      import fancyNavbar from "./fancy-navbar.hbs";
      import formBuilder from "./form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      window.define("the-app/templates/components/fancy-navbar", () => fancyNavbar);
      export default precompileTemplate("\\n        <FormBuilder @navbar={{component \\"fancy-navbar\\"}} as |bar|>\\n          {{component bar}}\\n        </FormBuilder>\\n        ", {
        moduleName: "my-app/templates/components/x.hbs"
      });
    `);
  });

  test('respects yieldsArguments rule for positional block param, curly', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: ['navbar'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      transform(
        'templates/components/x.hbs',
        `
        {{#form-builder navbar=(component "fancy-navbar") as |bar|}}
          {{component bar}}
        {{/form-builder}}
        `
      )
    ).toEqualCode(`
      import fancyNavbar from "./fancy-navbar.hbs";
      import formBuilder from "./form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      window.define("the-app/templates/components/fancy-navbar", () => fancyNavbar);
      export default precompileTemplate("\\n        {{#form-builder navbar=(component \\"fancy-navbar\\") as |bar|}}\\n          {{component bar}}\\n        {{/form-builder}}\\n        ", {
        moduleName: "my-app/templates/components/x.hbs"
      });
    `);
  });

  test('respects yieldsArguments rule for hash block param', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: [
              {
                bar: 'navbar',
              },
            ],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      transform(
        'templates/components/x.hbs',
        `
        <FormBuilder @navbar={{component "fancy-navbar"}} as |f|>
          {{component f.bar}}
        </FormBuilder>
        `
      )
    ).toEqualCode(`
      import fancyNavbar from "./fancy-navbar.hbs";
      import formBuilder from "./form-builder.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/form-builder", () => formBuilder);
      window.define("the-app/templates/components/fancy-navbar", () => fancyNavbar);
      export default precompileTemplate("\\n        <FormBuilder @navbar={{component \\"fancy-navbar\\"}} as |f|>\\n          {{component f.bar}}\\n        </FormBuilder>\\n        ", {
        moduleName: "my-app/templates/components/x.hbs"
      });
    `);
  });

  test('yieldsArguments causes warning to propagate up lexically, angle', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: ['navbar'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/components/x.hbs',
        `
        <FormBuilder @navbar={{this.unknown}} as |bar|>
          {{component bar}}
        </FormBuilder>
        `
      );
    }).toThrow(
      /argument "navbar" to component "FormBuilder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test('yieldsArguments causes warning to propagate up lexically, curl', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: ['navbar'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/components/x.hbs',
        `
        {{#form-builder navbar=this.unknown as |bar|}}
          {{component bar}}
        {{/form-builder}}
        `
      );
    }).toThrow(
      /argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test('yieldsArguments causes warning to propagate up lexically, multiple levels', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            yieldsArguments: ['navbar'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      transform(
        'templates/components/x.hbs',
        `
          {{#form-builder navbar=this.unknown as |bar1|}}
            {{#form-builder navbar=bar1 as |bar2|}}
              {{component bar2}}
            {{/form-builder}}
          {{/form-builder}}
          `
      );
    }).toThrow(
      /argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test('respects invokes rule on a component', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        components: {
          '<FormBuilder />': {
            invokes: { 'this.which': ['<Alpha/>'] },
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(transform('templates/components/form-builder.hbs', `{{component this.which}}`)).toEqualCode(`
      import alpha0 from "../../components/alpha.js";
      import alpha from "./alpha.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/alpha", () => alpha);
      window.define("the-app/components/alpha", () => alpha0);
      export default precompileTemplate("{{component this.which}}", {
        moduleName: "my-app/templates/components/form-builder.hbs"
      });
    `);
  });

  test('respects invokes rule on a non-component app template', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'the-test-package',
        appTemplates: {
          'templates/index.hbs': {
            invokes: { 'this.which': ['<Alpha/>'] },
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('templates/index.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(transform('templates/index.hbs', `{{component this.which}}`)).toEqualCode(`
      import alpha0 from "../components/alpha.js";
      import alpha from "./components/alpha.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/alpha", () => alpha);
      window.define("the-app/components/alpha", () => alpha0);
      export default precompileTemplate("{{component this.which}}", {
        moduleName: "my-app/templates/index.hbs"
      });
    `);
  });

  test('respects invokes rule on a non-component addon template', function () {
    let packageRules: PackageRules[] = [
      {
        package: 'my-addon',
        addonTemplates: {
          'templates/index.hbs': {
            invokes: { 'this.which': ['<Alpha/>'] },
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules });
    givenFile('node_modules/my-addon/templates/index.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(transform('node_modules/my-addon/templates/index.hbs', `{{component this.which}}`)).toEqualCode(`
      import alpha0 from "../../../components/alpha.js";
      import alpha from "../../../templates/components/alpha.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/alpha", () => alpha);
      window.define("the-app/components/alpha", () => alpha0);
      export default precompileTemplate("{{component this.which}}", {
        moduleName: "my-app/node_modules/my-addon/templates/index.hbs"
      });
    `);
  });

  test('rejects arbitrary expression in component helper', function () {
    let transform = configure({ staticComponents: true });
    expect(() => transform('templates/application.hbs', `{{component (some-helper this.which) }}`)).toThrow(
      `Unsafe dynamic component: cannot statically analyze this expression`
    );
  });

  test('ignores any non-string-literal in "helper" keyword', function () {
    let transform = configure({ staticHelpers: true });
    expect(transform('templates/application.hbs', `{{helper this.which}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{helper this.which}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('ignores any non-string-literal in "modifier" keyword', function () {
    let transform = configure({ staticModifiers: true });
    expect(transform('templates/application.hbs', `<div {{(modifier this.which)}}></div>`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<div {{(modifier this.which)}}></div>", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('trusts inline ensure-safe-component helper', function () {
    let transform = configure({ staticComponents: true });
    expect(transform('templates/application.hbs', `{{component (ensure-safe-component this.which) }}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component (ensure-safe-component this.which)}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
});

function emberHolyFuturisticNamespacingBatmanTransform(env: ASTPluginEnvironment) {
  let sigil = '$';
  let b = env.syntax.builders;

  function rewriteOrWrapComponentParam(node: AST.MustacheStatement | AST.SubExpression | AST.BlockStatement) {
    if (!node.params.length) {
      return;
    }

    let firstParam = node.params[0];
    if (firstParam.type !== 'StringLiteral') {
      // note: does not support dynamic / runtime strings
      return;
    }

    node.params[0] = b.string(firstParam.original.replace(sigil, '@'));
  }

  return {
    name: 'ember-holy-futuristic-template-namespacing-batman:namespacing-transform',

    visitor: {
      PathExpression(node: AST.PathExpression) {
        if (node.parts.length > 1 || !node.original.includes(sigil)) {
          return;
        }

        return b.path(node.original.replace(sigil, '@'), node.loc);
      },
      ElementNode(node: AST.ElementNode) {
        if (node.tag.indexOf(sigil) > -1) {
          node.tag = node.tag.replace(sigil, '@');
        }
      },
      MustacheStatement(node: AST.MustacheStatement) {
        if (node.path.type === 'PathExpression' && node.path.original === 'component') {
          // we don't care about non-component expressions
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
      SubExpression(node: AST.SubExpression) {
        if (node.path.type === 'PathExpression' && node.path.original !== 'component') {
          // we don't care about non-component expressions
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
      BlockStatement(node: AST.BlockStatement) {
        if (node.path.type === 'PathExpression' && node.path.original !== 'component') {
          // we don't care about blocks not using component
          return;
        }
        rewriteOrWrapComponentParam(node);
      },
    },
  };
}
