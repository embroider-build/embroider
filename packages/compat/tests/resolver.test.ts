import { removeSync, mkdtempSync, writeFileSync, ensureDirSync, writeJSONSync, realpathSync } from 'fs-extra';
import { join, dirname } from 'path';
import Options, { optionsWithDefaults } from '../src/options';
import { hbsToJS, tmpdir, throwOnWarnings } from '@embroider/core';
import { emberTemplateCompiler } from '@embroider/test-support';
import { Options as AdjustImportsOptions } from '@embroider/core/src/babel-plugin-adjust-imports';
import Resolver from '../src/resolver';
import { PackageRules } from '../src';
import type { AST, ASTPluginEnvironment } from '@glimmer/syntax';
import 'code-equality-assertions/jest';
import type { Transform, Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { TransformOptions, transformSync } from '@babel/core';

describe('compat-resolver', function () {
  let appDir: string;

  function configure(
    compatOptions: Options,
    otherOptions: {
      podModulePrefix?: string;
      adjustImportsImports?: Partial<AdjustImportsOptions>;
      plugins?: Transform[];
      startingFrom?: 'hbs' | 'js';
    } = {}
  ) {
    appDir = realpathSync(mkdtempSync(join(tmpdir, 'embroider-compat-tests-')));
    writeJSONSync(join(appDir, 'package.json'), { name: 'the-app' });
    let resolver = new Resolver({
      emberVersion: emberTemplateCompiler().version,
      root: appDir,
      modulePrefix: 'the-app',
      podModulePrefix: otherOptions.podModulePrefix,
      options: optionsWithDefaults(compatOptions),
      activePackageRules: optionsWithDefaults(compatOptions).packageRules.map(rule => {
        let root = rule.package === 'the-test-package' ? appDir : `${appDir}/node_modules/${rule.package}`;
        return Object.assign({ roots: [root] }, rule);
      }),
      adjustImportsOptions: Object.assign(
        {
          renamePackages: {},
          renameModules: {},
          extraImports: [],
          externalsDir: '/tmp/embroider-externals',
          activeAddons: {},
          relocatedFiles: {},
          resolvableExtensions: ['.js', '.hbs'],
          appRoot: appDir,
        },
        otherOptions.adjustImportsImports
      ),
    });

    let transforms: Transform[] = [];
    let resolverTransform = resolver.astTransformer();

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

  test('emits no components when staticComponents is off', function () {
    let transform = configure({ staticComponents: false });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{hello-world}} <HelloWorld />`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{hello-world}} <HelloWorld />", {
        moduleName: "my-app/templates/application.hbs",
      });`);
  });

  test('bare dasherized component, js only', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
        import helloWorld from "../components/hello-world.js";
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{helloWorld}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            helloWorld
          }),
        });
    `);
  });

  test('nested bare dasherized component, js only', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/something/hello-world.js');
    expect(transform('templates/application.hbs', `{{something/hello-world}}`)).toEqualCode(`
        import somethingHelloWorld from "../components/something/hello-world.js";
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate("{{somethingHelloWorld}}", {
          moduleName: "my-app/templates/application.hbs",
          scope: () => ({
            somethingHelloWorld,
          }),
        });
    `);
  });

  describe('bare namespaced', function () {
    test('dasherized component, js only', function () {
      let transform = configure({ staticComponents: true });
      givenFile('components/hello-world/index.js');
      expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
          import helloWorld from "../components/hello-world/index.js";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            }),
          });`);
    });

    test('dasherized component, js and hbs', function () {
      let transform = configure({ staticComponents: true });
      givenFile('components/hello-world/index.js');
      givenFile('components/hello-world/index.hbs');
      // the resolver only needs to handle the JS. Template-colocation causes
      // the JS to already import the HBS. That is also why we don't have a test
      // here for the hbs-only case -- from the resolver's perspective that case
      // doesn't exist, because we will have always synthesized the JS before
      // getting to the resolver.
      expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
          import helloWorld from "../components/hello-world/index.js";
          import { precompileTemplate } from "@ember/template-compilation";
          export default precompileTemplate("{{helloWorld}}", {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              helloWorld
            }),
          });
      `);
    });
  });

  test('podded, dasherized component, with blank podModulePrefix, js only', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world/component.js');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import helloWorld from "../components/hello-world/component.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{helloWorld}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld
        }),
      });
    `);
  });

  test('podded, dasherized component, with blank podModulePrefix, hbs only', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world/template.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import template from "../components/hello-world/template.hbs"
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/components/hello-world/template", () => template);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('podded, dasherized component, with blank podModulePrefix, js and hbs', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world/component.js');
    givenFile('components/hello-world/template.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import component from "../components/hello-world/component.js";
      import template from "../components/hello-world/template.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/components/hello-world/template", () => template);
      window.define("the-app/components/hello-world/component", () => component);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, js only', function () {
    let transform = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/component.js');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import helloWorld from "../pods/components/hello-world/component.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{helloWorld}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld
        }),
      });
    `);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, hbs only', function () {
    let transform = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/template.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import template from "../pods/components/hello-world/template.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/pods/components/hello-world/template", () => template);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, js and hbs', function () {
    let transform = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/component.js');
    givenFile('pods/components/hello-world/template.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import component from "../pods/components/hello-world/component.js";
      import template from "../pods/components/hello-world/template.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/pods/components/hello-world/template", () => template);
      window.define("the-app/pods/components/hello-world/component", () => component);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('bare dasherized component, hbs only', function () {
    let transform = configure({ staticComponents: true });
    givenFile('templates/components/hello-world.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import helloWorld from "./components/hello-world.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/hello-world", () => helloWorld);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('bare dasherized component, js and hbs', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import helloWorld0 from "../components/hello-world.js";
      import helloWorld from "./components/hello-world.hbs";
      import { precompileTemplate } from "@ember/template-compilation";
      window.define("the-app/templates/components/hello-world", () => helloWorld);
      window.define("the-app/components/hello-world", () => helloWorld0);
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs",
      });
    `);
  });

  test('coalesces repeated components', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{hello-world}}{{hello-world}}`)).toEqualCode(`
      import helloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{helloWorld}}{{helloWorld}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld,
        }),
      });
    `);
  });

  test('tolerates non path mustaches', function () {
    let transform = configure({ staticComponents: false, staticHelpers: true }, { startingFrom: 'js' });
    let src = hbsToJS('<Thing @foo={{1}} />');
    expect(transform('templates/application.js', src)).toEqualCode(src);
  });

  test('block form curly component', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{#hello-world}} {{/hello-world}}`)).toEqualCode(`
      import helloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#helloWorld}} {{/helloWorld}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld,
        }),
      });
    `);
  });

  test('block form angle component', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `<HelloWorld></HelloWorld>`)).toEqualCode(`
      import HelloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<HelloWorld></HelloWorld>", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          HelloWorld,
        }),
      });
    `);
  });

  test('curly contextual component', function () {
    let transform = configure({ staticComponents: true, staticHelpers: true }, { startingFrom: 'js' });
    let src = `
      import { precompileTemplate } from '@ember/template-compilation';
      precompileTemplate('{{#helloWorld as |h|}} {{h.title flavor="chocolate"}} {{/helloWorld}}', {
        scope: () => ({ helloWorld })
      });
    `;
    expect(transform('templates/application.js', src)).toEqualCode(src);
  });

  test('angle contextual component, upper', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `<HelloWorld as |H|> <H.title @flavor="chocolate" /> </HelloWorld>`))
      .toEqualCode(`
        import HelloWorld from "../components/hello-world.js";
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate(
          '<HelloWorld as |H|> <H.title @flavor="chocolate" /> </HelloWorld>',
          {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld,
            }),
          }
        );
      `);
  });

  test('acceptsComponentArguments works on all copies of a lexically-inserted component, element syntax', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<HelloWorld />': {
            acceptsComponentArguments: ['iAmAComponent'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules }, { startingFrom: 'js' });
    givenFile('components/hello-world.js');
    givenFile('components/first-target.js');
    givenFile('components/second-target.js');

    expect(
      transform(
        'templates/application.hbs',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate("<HelloWorld @iAmAComponent='first-target' /><HelloWorld @iAmAComponent='second-target' />");
        `
      )
    ).toEqualCode(`
      import secondTarget from "../components/second-target.js";
      import firstTarget from "../components/first-target.js";
      import HelloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      precompileTemplate(
        "<HelloWorld @iAmAComponent={{firstTarget}} /><HelloWorld @iAmAComponent={{secondTarget}} />",
        {
          scope: () => ({
            HelloWorld,
            firstTarget,
            secondTarget,
          }),
        }
      );
    `);
  });

  test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache syntax', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<Hello />': {
            acceptsComponentArguments: ['iAmAComponent'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules }, { startingFrom: 'js' });
    givenFile('components/hello.js');
    givenFile('components/first-target.js');
    givenFile('components/second-target.js');

    expect(
      transform(
        'templates/application.hbs',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate("{{hello iAmAComponent='first-target' }}{{hello iAmAComponent='second-target' }}");
        `
      )
    ).toEqualCode(`
      import secondTarget from "../components/second-target.js";
      import firstTarget from "../components/first-target.js";
      import hello from "../components/hello.js";
      import { precompileTemplate } from "@ember/template-compilation";
      precompileTemplate(
        "{{hello iAmAComponent=firstTarget}}{{hello iAmAComponent=secondTarget}}",
        {
          scope: () => ({
            hello,
            firstTarget,
            secondTarget,
          }),
        }
      );
    `);
  });

  test('acceptsComponentArguments works on all copies of a lexically-inserted component, mustache-block syntax', function () {
    let packageRules = [
      {
        package: 'the-test-package',
        components: {
          '<Hello />': {
            acceptsComponentArguments: ['iAmAComponent'],
          },
        },
      },
    ];
    let transform = configure({ staticComponents: true, packageRules }, { startingFrom: 'js' });
    givenFile('components/hello.js');
    givenFile('components/first-target.js');
    givenFile('components/second-target.js');

    expect(
      transform(
        'templates/application.hbs',
        `
          import { precompileTemplate } from '@ember/template-compilation';
          precompileTemplate("{{#hello iAmAComponent='first-target' }}{{/hello}}{{#hello iAmAComponent='second-target' }}{{/hello}}");
        `
      )
    ).toEqualCode(`
      import secondTarget from "../components/second-target.js";
      import firstTarget from "../components/first-target.js";
      import hello from "../components/hello.js";
      import { precompileTemplate } from "@ember/template-compilation";
      precompileTemplate(
        '{{#hello iAmAComponent=firstTarget}}{{/hello}}{{#hello iAmAComponent=secondTarget}}{{/hello}}',
        {
          scope: () => ({
            hello,
            firstTarget,
            secondTarget,
          }),
        }
      );
    `);
  });

  test('angle contextual component, lower', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `<HelloWorld as |h|> <h.title @flavor="chocolate" /> </HelloWorld>`))
      .toEqualCode(`
        import HelloWorld from "../components/hello-world.js";
        import { precompileTemplate } from "@ember/template-compilation";
        export default precompileTemplate(
          '<HelloWorld as |h|> <h.title @flavor="chocolate" /> </HelloWorld>',
          {
            moduleName: "my-app/templates/application.hbs",
            scope: () => ({
              HelloWorld,
            }),
          }
        );
      `);
  });

  test('optional component missing in mustache', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
      packageRules: [
        {
          package: 'the-test-package',
          components: {
            '{{this-one}}': { safeToIgnore: true },
          },
        },
      ],
    });
    expect(transform('templates/application.hbs', `{{this-one x=true}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{this-one x=true}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('component rules can be expressed via component helper', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
      packageRules: [
        {
          package: 'the-test-package',
          components: {
            '{{component "this-one"}}': { safeToIgnore: true },
          },
        },
      ],
    });
    expect(transform('templates/application.hbs', `{{this-one x=true}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{this-one x=true}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });

  test('optional component missing in mustache block', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
      packageRules: [
        {
          package: 'the-test-package',
          components: {
            '{{this-one}}': { safeToIgnore: true },
          },
        },
      ],
    });
    expect(transform('templates/application.hbs', `{{#this-one}} {{/this-one}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#this-one}} {{/this-one}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('optional component declared as element missing in mustache block', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
      packageRules: [
        {
          package: 'the-test-package',
          components: {
            '<ThisOne />': { safeToIgnore: true },
          },
        },
      ],
    });
    expect(transform('templates/application.hbs', `{{#this-one}} {{/this-one}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#this-one}} {{/this-one}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('optional component missing in element', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
      packageRules: [
        {
          package: 'the-test-package',
          components: {
            '{{this-one}}': { safeToIgnore: true },
          },
        },
      ],
    });
    expect(transform('templates/application.hbs', `<ThisOne/>`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<ThisOne />", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('class defined helper not failing if there is no arguments', function () {
    let transform = configure({ staticHelpers: true });
    expect(transform('templates/application.hbs', `{{(this.myHelper)}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{(this.myHelper)}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('class defined helper not failing with arguments', function () {
    let transform = configure({ staticHelpers: true });
    expect(transform('templates/application.hbs', `{{(this.myHelper 42)}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{(this.myHelper 42)}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('helper defined in component not failing if there is no arguments', function () {
    let transform = configure({ staticComponents: true, staticHelpers: true });
    expect(transform('templates/application.hbs', `{{#if (this.myHelper)}}{{/if}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#if (this.myHelper)}}{{/if}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('class defined component not failing if there is a block', function () {
    let transform = configure({ staticComponents: true, staticHelpers: true });
    expect(transform('templates/application.hbs', `{{#this.myComponent}}hello{{/this.myComponent}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#this.myComponent}}hello{{/this.myComponent}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('class defined component not failing with arguments', function () {
    let transform = configure({ staticComponents: true, staticHelpers: true });
    expect(transform('templates/application.hbs', `{{#this.myComponent 42}}{{/this.myComponent}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#this.myComponent 42}}{{/this.myComponent}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('mustache missing, no args', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
    });
    expect(transform('templates/application.hbs', `{{hello-world}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{hello-world}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('mustache missing, with args', function () {
    let transform = configure({
      staticComponents: true,
      staticHelpers: true,
    });
    expect(() => {
      transform('templates/application.hbs', `{{hello-world foo=bar}}`);
    }).toThrow(new RegExp(`Missing component or helper: hello-world in templates/application.hbs`));
  });

  test('string literal passed to component helper in content position', function () {
    let transform = configure({
      staticComponents: true,
    });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{component "hello-world"}}`)).toEqualCode(`
      import helloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate('{{component helloWorld}}', {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld,
        }),
      });
    `);
  });

  test('string literal passed to "helper" keyword in content position', function () {
    let transform = configure({
      staticHelpers: true,
    });
    givenFile('helpers/hello-world.js');
    expect(transform('templates/application.hbs', `{{helper "hello-world"}}`)).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{helper \\"hello-world\\"}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('string literal passed to "modifier" keyword in content position', function () {
    let transform = configure({
      staticModifiers: true,
    });
    givenFile('modifiers/add-listener.js');
    expect(
      transform(
        'templates/application.hbs',
        `<button {{(modifier "add-listener" "click" this.handleClick)}}>Test</button>`
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<button {{(modifier \\"add-listener\\" \\"click\\" this.handleClick)}}>Test</button>", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('modifier currying using the "modifier" keyword', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/add-listener.js');
    expect(
      transform(
        'templates/application.hbs',
        `{{#let (modifier "add-listener") as |addListener|}}
          {{#let (modifier addListener "click") as |addClickListener|}}
            <button {{addClickListener this.handleClick}}>Test</button>
          {{/let}}
        {{/let}}`
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{#let (modifier \\"add-listener\\") as |addListener|}}\\n          {{#let (modifier addListener \\"click\\") as |addClickListener|}}\\n            <button {{addClickListener this.handleClick}}>Test</button>\\n          {{/let}}\\n        {{/let}}", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('built-in components are ignored when used with the component helper', function () {
    let transform = configure({
      staticComponents: true,
    });
    expect(
      transform(
        'templates/application.hbs',
        `
      {{component "input"}}
      {{component "link-to"}}
      {{component "textarea"}}
    `
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n      {{component \\"input\\"}}\\n      {{component \\"link-to\\"}}\\n      {{component \\"textarea\\"}}\\n    ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('built-in helpers are ignored when used with the "helper" keyword', function () {
    let transform = configure({
      staticHelpers: true,
    });
    expect(
      transform(
        'templates/application.hbs',
        `
      {{helper "fn"}}
      {{helper "array"}}
      {{helper "concat"}}
    `
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n      {{helper \\"fn\\"}}\\n      {{helper \\"array\\"}}\\n      {{helper \\"concat\\"}}\\n    ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('built-in modifiers are ignored when used with the "modifier" keyword', function () {
    let transform = configure({
      staticModifiers: true,
    });
    expect(
      transform(
        'templates/application.hbs',
        `
      <button {{(modifier "on" "click" this.handleClick)}}>Test</button>
      <button {{(modifier "action" "handleClick")}}>Test</button>
    `
      )
    ).toEqualCode(`
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n      <button {{(modifier \\"on\\" \\"click\\" this.handleClick)}}>Test</button>\\n      <button {{(modifier \\"action\\" \\"handleClick\\")}}>Test</button>\\n    ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('component helper with direct addon package reference', function () {
    let transform = configure({
      staticComponents: true,
    });
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(transform('templates/application.hbs', `{{component "my-addon@thing"}}`)).toEqualCode(`
      import thing from "../node_modules/my-addon/components/thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component thing}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          thing
        })
      });
    `);
  });
  test('component helper with direct addon package reference to a renamed package', function () {
    let transform = configure(
      {
        staticComponents: true,
      },
      {
        adjustImportsImports: {
          renamePackages: {
            'has-been-renamed': 'my-addon',
          },
        },
      }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(transform('templates/application.hbs', `{{component "has-been-renamed@thing"}}`)).toEqualCode(`
      import thing from "../node_modules/my-addon/components/thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{component thing}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          thing
        })
      });
    `);
  });
  test('angle bracket invocation of component with @ syntax', function () {
    let transform = configure(
      {
        staticComponents: true,
      },
      { plugins: [emberHolyFuturisticNamespacingBatmanTransform] }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(transform('templates/application.hbs', `<MyAddon$Thing />`)).toEqualCode(`
      import MyAddonThing from "../node_modules/my-addon/components/thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<MyAddonThing />", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          MyAddonThing
        })
      });
    `);
  });
  test('angle bracket invocation of component with @ syntax - self reference inside node_modules', function () {
    let transform = configure(
      {
        staticComponents: true,
      },
      { plugins: [emberHolyFuturisticNamespacingBatmanTransform] }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(transform('node_modules/my-addon/components/foo.hbs', `<MyAddon$Thing />`)).toEqualCode(`
      import MyAddonThing from "./thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("<MyAddonThing />", {
        moduleName: "my-app/node_modules/my-addon/components/foo.hbs",
        scope: () => ({
          MyAddonThing
        })
      });
    `);
  });
  test('helper with @ syntax', function () {
    let transform = configure(
      {
        staticHelpers: true,
      },
      { plugins: [emberHolyFuturisticNamespacingBatmanTransform] }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon" }`);
    givenFile('node_modules/my-addon/helpers/thing.js');
    expect(transform('templates/application.hbs', `{{my-addon$thing}}`)).toEqualCode(`
      import thing from "../node_modules/my-addon/helpers/thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{thing}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          thing
        })
      });
    `);
  });
  test('helper with @ syntax and direct addon package reference to a renamed package', function () {
    let transform = configure(
      {
        staticHelpers: true,
      },
      {
        adjustImportsImports: {
          renamePackages: {
            'has-been-renamed': 'my-addon',
          },
        },
        plugins: [emberHolyFuturisticNamespacingBatmanTransform],
      }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/helpers/thing.js');
    expect(transform('templates/application.hbs', `{{has-been-renamed$thing}}`)).toEqualCode(`
      import thing from "../node_modules/my-addon/helpers/thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{thing}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          thing
        })
      });
    `);
  });
  test('string literal passed to component helper with block', function () {
    let transform = configure({
      staticComponents: true,
    });
    givenFile('components/hello-world.js');
    expect(transform('templates/application.hbs', `{{#component "hello-world"}} {{/component}}`)).toEqualCode(`
      import helloWorld from "../components/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate('{{#component helloWorld}} {{/component}}', {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          helloWorld,
        }),
      });
    `);
  });
  test('string literal passed to component helper in helper position', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('components/my-thing.js');
    expect(transform('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`)).toEqualCode(`
      import helloWorld from "../components/hello-world.js";
      import myThing from "../components/my-thing.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("{{myThing header=(component helloWorld)}}", {
        moduleName: "my-app/templates/application.hbs",
        scope: () => ({
          myThing,
          helloWorld,
        }),
      });
    `);
  });

  test.skip('string literal passed to "helper" keyword in helper position', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/hello-world.js');
    expect(
      transform(
        'templates/application.hbs',
        `
        {{#let (helper "hello-world") as |helloWorld|}}
          {{helloWorld}}
        {{/let}}
        `
      )
    ).toEqualCode(`
      import HelloWorld from "../helpers/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{#let (helper HelloWorld) as |helloWorld|}}\\n          {{helloWorld}}\\n        {{/let}}\\n        ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test.skip('helper currying using the "helper" keyword', function () {
    let transform = configure({ staticHelpers: true });
    givenFile('helpers/hello-world.js');
    expect(
      transform(
        'templates/application.hbs',
        `
        {{#let (helper "hello-world" name="World") as |hello|}}
          {{#let (helper hello name="Tomster") as |helloTomster|}}
            {{helloTomster name="Zoey"}}
          {{/let}}
        {{/let}}
        `
      )
    ).toEqualCode(`
      import HelloWorld from "../helpers/hello-world.js";
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{#let (helper HelloWorld name=\\"World\\") as |hello|}}\\n          {{#let (helper hello name=\\"Tomster\\") as |helloTomster|}}\\n            {{helloTomster name=\\"Zoey\\"}}\\n          {{/let}}\\n        {{/let}}\\n        ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test.skip('string literal passed to "modifier" keyword in helper position', function () {
    let transform = configure({ staticModifiers: true });
    givenFile('modifiers/add-listener.js');
    expect(
      transform(
        'templates/application.hbs',
        `
        {{#let (modifier "add-listener" "click") as |addClickListener|}}
          <button {{addClickListener this.handleClick}}>Test</button>
        {{/let}}
        `
      )
    ).toEqual(`
      import AddListener from D../modifiers/add-listener.jsD;
      import { precompileTemplate } from "@ember/template-compilation";
      export default precompileTemplate("\\n        {{#let (modifier AddListener \\"click\\") as |addClickListener|}}\\n          <button {{addClickListener this.handleClick}}>Test</button>\\n        {{/let}}\\n        ", {
        moduleName: "my-app/templates/application.hbs"
      });
    `);
  });
  test('string literal passed to component helper fails to resolve', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/my-thing.js');
    expect(() => {
      transform('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`);
    }).toThrow(new RegExp(`Missing component: hello-world in templates/application.hbs`));
  });
  test.skip('string literal passed to "helper" keyword fails to resolve', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{helper "hello-world"}}`);
    }).toThrow(new RegExp(`Missing helper: hello-world in templates/application.hbs`));
  });
  test.skip('string literal passed to "modifier" keyword fails to resolve', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(() => {
      findDependencies(
        'templates/application.hbs',
        `<button {{(modifier "add-listener" "click" this.handleClick)}}>Test</button>`
      );
    }).toThrow(new RegExp(`Missing modifier: add-listener in templates/application.hbs`));
  });
  test.skip('string literal passed to component helper fails to resolve when staticComponents is off', function () {
    let findDependencies = configure({ staticComponents: false });
    givenFile('components/my-thing.js');
    expect(findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`)).toEqual([]);
  });
  test.skip('string literal passed to "helper" keyword fails to resolve when staticHelpers is off', function () {
    let findDependencies = configure({ staticHelpers: false });
    givenFile('helpers/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{helper "hello-world"}}`)).toEqual([]);
  });
  test.skip('string literal passed to "modifier" keyword fails to resolve when staticModifiers is off', function () {
    let findDependencies = configure({ staticModifiers: false });
    givenFile('modifiers/add-listener.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `<button {{(modifier "add-listener" "click" this.handleClick)}}>Test</button>`
      )
    ).toEqual([]);
  });

  test('dynamic component helper error in content position', function () {
    let transform = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(() => {
      transform('templates/application.hbs', `{{component this.which}}`);
    }).toThrow(/Unsafe dynamic component: this\.which in templates\/application\.hbs/);
  });

  test.skip('angle component, js and hbs', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    expect(findDependencies('templates/application.hbs', `<HelloWorld />`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
      {
        path: './components/hello-world.hbs',
        runtimeName: 'the-app/templates/components/hello-world',
      },
    ]);
  });
  test.skip('nested angle component, js and hbs', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/something/hello-world.js');
    givenFile('templates/components/something/hello-world.hbs');
    expect(findDependencies('templates/application.hbs', `<Something::HelloWorld />`)).toEqual([
      {
        path: '../components/something/hello-world.js',
        runtimeName: 'the-app/components/something/hello-world',
      },
      {
        path: './components/something/hello-world.hbs',
        runtimeName: 'the-app/templates/components/something/hello-world',
      },
    ]);
  });
  test.skip('angle component missing', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(() => {
      findDependencies('templates/application.hbs', `<HelloWorld />`);
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
  test.skip('missing subexpression with args', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{#each (things 1 2 3) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test.skip('missing subexpression no args', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{#each (things) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test.skip('emits no helpers when staticHelpers is off', function () {
    let findDependencies = configure({ staticHelpers: false });
    givenFile('helpers/array.js');
    expect(findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`)).toEqual(
      []
    );
  });
  test.skip('helper as component argument', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    expect(findDependencies('templates/application.hbs', `{{my-component value=(array 1 2 3) }}`)).toEqual([
      {
        runtimeName: 'the-app/helpers/array',
        path: '../helpers/array.js',
      },
    ]);
  });
  test.skip('helper as html attribute', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(findDependencies('templates/application.hbs', `<div data-foo={{capitalize name}}></div>`)).toEqual([
      {
        runtimeName: 'the-app/helpers/capitalize',
        path: '../helpers/capitalize.js',
      },
    ]);
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

  test.skip('missing modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `<canvas {{fancy-drawing}}></canvas>`);
    }).toThrow(new RegExp(`Missing modifier: fancy-drawing in templates/application.hbs`));
  });
  test.skip('emits no modifiers when staticModifiers is off', function () {
    let findDependencies = configure({ staticModifiers: false });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<input {{auto-focus}} />`)).toEqual([]);
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

  test.skip('modifier on component', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<StyledInput {{auto-focus}} />`)).toEqual([
      {
        runtimeName: 'the-app/modifiers/auto-focus',
        path: '../modifiers/auto-focus.js',
      },
    ]);
  });
  test.skip('modifier on contextual component', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<Form as |f|> <f.Input {{auto-focus}} /></Form>`)).toEqual([
      {
        runtimeName: 'the-app/modifiers/auto-focus',
        path: '../modifiers/auto-focus.js',
      },
    ]);
  });
  test.skip('modifier provided as an argument', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('components/test.hbs', `<input {{@auto-focus}} />`)).toEqual([]);
  });
  test.skip('contextual modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<Form as |f|> <input {{f.auto-focus}} /></Form>`)).toEqual(
      []
    );
  });
  test.skip('local binding takes precedence over helper in bare mustache', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(
      findDependencies('templates/application.hbs', `{{#each things as |capitalize|}} {{capitalize}} {{/each}}`)
    ).toEqual([]);
  });
  test.skip('local binding takes precedence over component in element position', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('components/the-thing.js');
    expect(
      findDependencies('templates/application.hbs', `{{#each things as |TheThing|}} <TheThing /> {{/each}}`)
    ).toEqual([]);
  });
  test.skip('local binding takes precedence over modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/some-modifier.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `{{#each modifiers as |some-modifier|}} <div {{some-modifier}}></div> {{/each}}`
      )
    ).toEqual([]);
  });
  test.skip('angle components can establish local bindings', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(findDependencies('templates/application.hbs', `<Outer as |capitalize|> {{capitalize}} </Outer>`)).toEqual(
      []
    );
  });
  test.skip('local binding only applies within block', function () {
    let findDependencies = configure({ staticHelpers: true, staticModifiers: true });
    givenFile('helpers/capitalize.js');
    givenFile('modifiers/validate.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#each things as |capitalize|}} {{capitalize}} {{/each}} {{capitalize}}
        <Form as |validate|><input {{validate}} /></Form> <input {{validate}} />
        `
      )
    ).toEqual([
      {
        runtimeName: 'the-app/helpers/capitalize',
        path: '../helpers/capitalize.js',
      },
      {
        runtimeName: 'the-app/modifiers/validate',
        path: '../modifiers/validate.js',
      },
    ]);
  });
  test.skip('ignores builtins', function () {
    let findDependencies = configure({ staticHelpers: true, staticComponents: true, staticModifiers: true });
    expect(
      findDependencies(
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
    ).toEqual([]);
  });

  test.skip('ignores dot-rule curly component invocation, inline', function () {
    let findDependencies = configure({ staticHelpers: true, staticComponents: true });
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{thing.body x=1}}
        `
      )
    ).toEqual([]);
  });
  test.skip('ignores dot-rule curly component invocation, block', function () {
    let findDependencies = configure({ staticHelpers: true, staticComponents: true });
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#thing.body}}
        {{/thing.body}}
        `
      )
    ).toEqual([]);
  });

  test.skip('respects yieldsSafeComponents rule, position 0', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    findDependencies(
      'templates/application.hbs',
      `
      {{#form-builder as |field| }}
        {{component field}}
      {{/form-builder}}
    `
    );
  });

  test.skip('respects yieldsSafeComponents rule on element, position 0', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    findDependencies(
      'templates/application.hbs',
      `
      <FormBuilder as |field| >
        {{component field}}
      </FormBuilder>
    `
    );
  });

  test.skip('respects yieldsSafeComponents rule, position 1', function () {
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
    let findDependencies = configure({
      staticComponents: true,
      packageRules,
    });
    givenFile('templates/components/form-builder.hbs');
    findDependencies(
      'templates/application.hbs',
      `
      {{#form-builder as |other field| }}
        {{component field}}
      {{/form-builder}}
    `
    );
    expect(() => {
      findDependencies(
        'templates/application.hbs',
        `
        {{#form-builder as |other field| }}
          {{component other}}
        {{/form-builder}}
      `
      );
    }).toThrow(/Unsafe dynamic component: other in templates\/application\.hbs/);
  });

  test.skip('respects yieldsSafeComponents rule, position 0.field', function () {
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
    let findDependencies = configure({
      staticComponents: true,
      packageRules,
    });
    givenFile('templates/components/form-builder.hbs');
    findDependencies(
      'templates/application.hbs',
      `
      {{#form-builder as |f| }}
        {{component f.field}}
      {{/form-builder}}
    `
    );
    expect(() => {
      findDependencies(
        'templates/application.hbs',
        `
        {{#form-builder as |f| }}
          {{component f.other}}
        {{/form-builder}}
      `
      );
    }).toThrow(/Unsafe dynamic component: f.other/);
  });

  test.skip('respects yieldsSafeComponents rule, position 1.field', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    findDependencies(
      'templates/application.hbs',
      `
      {{#form-builder as |x f| }}
        {{component f.field}}
      {{/form-builder}}
    `
    );
    expect(() => {
      findDependencies(
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

  test.skip('acceptsComponentArguments argument name may include optional @', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(findDependencies('templates/application.hbs', `{{form-builder title="fancy-title"}}`)).toEqual([
      {
        runtimeName: 'the-app/templates/components/fancy-title',
        path: './components/fancy-title.hbs',
      },
      {
        runtimeName: 'the-app/templates/components/form-builder',
        path: './components/form-builder.hbs',
      },
    ]);
  });

  test.skip('acceptsComponentArguments on mustache with component subexpression', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(findDependencies('templates/application.hbs', `{{form-builder title=(component "fancy-title") }}`)).toEqual([
      {
        runtimeName: 'the-app/templates/components/fancy-title',
        path: './components/fancy-title.hbs',
      },
      {
        runtimeName: 'the-app/templates/components/form-builder',
        path: './components/form-builder.hbs',
      },
    ]);
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

  test.skip('acceptsComponentArguments matches co-located template', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    expect(findDependencies('components/form-builder.hbs', `{{component title}}`)).toEqual([]);
  });

  test.skip(`element block params are not in scope for element's own attributes`, function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      expect(
        findDependencies('templates/application.hbs', `<FormBuilder @title={{title}} as |title|></FormBuilder>`)
      ).toEqual([
        {
          runtimeName: 'the-app/templates/components/form-builder',
          path: './components/form-builder.hbs',
        },
      ]);
    }).toThrow(
      /argument "title" to component "FormBuilder" is treated as a component, but the value you're passing is dynamic: title/
    );
  });

  test.skip('acceptsComponentArguments on mustache with invalid literal', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      findDependencies('templates/application.hbs', `{{form-builder title="fancy-title"}}`);
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

  test.skip('acceptsComponentArguments interior usage of path generates no warning', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component title}}`)).toEqual([]);
  });

  test.skip('acceptsComponentArguments interior usage of this.path generates no warning', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component this.title}}`)).toEqual([]);
  });

  test.skip('acceptsComponentArguments interior usage of @path generates no warning', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component @title}}`)).toEqual([]);
  });

  test.skip('safeToIgnore a missing component', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/x.hbs', `<FormBuilder />`)).toEqual([]);
  });

  test.skip('safeToIgnore a present component', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(findDependencies('templates/components/x.hbs', `<FormBuilder />`)).toEqual([
      {
        path: './form-builder.hbs',
        runtimeName: 'the-app/templates/components/form-builder',
      },
    ]);
  });

  test.skip('respects yieldsArguments rule for positional block param, angle', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      findDependencies(
        'templates/components/x.hbs',
        `
        <FormBuilder @navbar={{component "fancy-navbar"}} as |bar|>
          {{component bar}}
        </FormBuilder>
        `
      )
    ).toEqual([
      {
        path: './fancy-navbar.hbs',
        runtimeName: 'the-app/templates/components/fancy-navbar',
      },
      {
        path: './form-builder.hbs',
        runtimeName: 'the-app/templates/components/form-builder',
      },
    ]);
  });

  test.skip('respects yieldsArguments rule for positional block param, curly', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      findDependencies(
        'templates/components/x.hbs',
        `
        {{#form-builder navbar=(component "fancy-navbar") as |bar|}}
          {{component bar}}
        {{/form-builder}}
        `
      )
    ).toEqual([
      {
        path: './fancy-navbar.hbs',
        runtimeName: 'the-app/templates/components/fancy-navbar',
      },
      {
        path: './form-builder.hbs',
        runtimeName: 'the-app/templates/components/form-builder',
      },
    ]);
  });

  test.skip('respects yieldsArguments rule for hash block param', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-navbar.hbs');
    expect(
      findDependencies(
        'templates/components/x.hbs',
        `
        <FormBuilder @navbar={{component "fancy-navbar"}} as |f|>
          {{component f.bar}}
        </FormBuilder>
        `
      )
    ).toEqual([
      {
        path: './fancy-navbar.hbs',
        runtimeName: 'the-app/templates/components/fancy-navbar',
      },
      {
        path: './form-builder.hbs',
        runtimeName: 'the-app/templates/components/form-builder',
      },
    ]);
  });

  test.skip('yieldsArguments causes warning to propagate up lexically, angle', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      expect(
        findDependencies(
          'templates/components/x.hbs',
          `
          <FormBuilder @navbar={{this.unknown}} as |bar|>
            {{component bar}}
          </FormBuilder>
          `
        )
      ).toEqual([
        {
          path: './form-builder.hbs',
          runtimeName: 'the-app/templates/components/form-builder',
        },
      ]);
    }).toThrow(
      /argument "navbar" to component "FormBuilder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test.skip('yieldsArguments causes warning to propagate up lexically, curl', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      expect(
        findDependencies(
          'templates/components/x.hbs',
          `
          {{#form-builder navbar=this.unknown as |bar|}}
            {{component bar}}
          {{/form-builder}}
          `
        )
      ).toEqual([
        {
          path: './form-builder.hbs',
          runtimeName: 'the-app/templates/components/form-builder',
        },
      ]);
    }).toThrow(
      /argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test.skip('yieldsArguments causes warning to propagate up lexically, multiple levels', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(() => {
      expect(
        findDependencies(
          'templates/components/x.hbs',
          `
          {{#form-builder navbar=this.unknown as |bar1|}}
            {{#form-builder navbar=bar1 as |bar2|}}
              {{component bar2}}
            {{/form-builder}}
          {{/form-builder}}
          `
        )
      ).toEqual([
        {
          path: './form-builder.hbs',
          runtimeName: 'the-app/templates/components/form-builder',
        },
      ]);
    }).toThrow(
      /argument "navbar" to component "form-builder" is treated as a component, but the value you're passing is dynamic: this\.unknown/
    );
  });

  test.skip('respects invokes rule on a component', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(findDependencies('templates/components/form-builder.hbs', `{{component this.which}}`)).toEqual([
      {
        path: '../../components/alpha.js',
        runtimeName: 'the-app/components/alpha',
      },
      {
        path: './alpha.hbs',
        runtimeName: 'the-app/templates/components/alpha',
      },
    ]);
  });

  test.skip('respects invokes rule on a non-component app template', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/index.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(findDependencies('templates/index.hbs', `{{component this.which}}`)).toEqual([
      {
        path: '../components/alpha.js',
        runtimeName: 'the-app/components/alpha',
      },
      {
        path: './components/alpha.hbs',
        runtimeName: 'the-app/templates/components/alpha',
      },
    ]);
  });

  test.skip('respects invokes rule on a non-component addon template', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/templates/index.hbs');
    givenFile('templates/components/alpha.hbs');
    givenFile('components/alpha.js');

    expect(findDependencies('node_modules/my-addon/templates/index.hbs', `{{component this.which}}`)).toEqual([
      {
        path: '../../../components/alpha.js',
        runtimeName: 'the-app/components/alpha',
      },
      {
        path: '../../../templates/components/alpha.hbs',
        runtimeName: 'the-app/templates/components/alpha',
      },
    ]);
  });

  test.skip('rejects arbitrary expression in component helper', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(() => findDependencies('templates/application.hbs', `{{component (some-helper this.which) }}`)).toThrow(
      `Unsafe dynamic component: cannot statically analyze this expression`
    );
  });

  test.skip('ignores any non-string-literal in "helper" keyword', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{helper this.which}}`)).toEqual([]);
  });

  test.skip('ignores any non-string-literal in "modifier" keyword', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(findDependencies('templates/application.hbs', `<div {{(modifier this.which)}}></div>`)).toEqual([]);
  });

  test.skip('trusts inline ensure-safe-component helper', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(findDependencies('templates/application.hbs', `{{component (ensure-safe-component this.which) }}`)).toEqual(
      []
    );
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
