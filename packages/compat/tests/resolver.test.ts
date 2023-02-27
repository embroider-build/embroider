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
