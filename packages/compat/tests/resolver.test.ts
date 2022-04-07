import { removeSync, mkdtempSync, writeFileSync, ensureDirSync, writeJSONSync, realpathSync } from 'fs-extra';
import { join, dirname } from 'path';
import Options, { optionsWithDefaults } from '../src/options';
import sortBy from 'lodash/sortBy';
import { tmpdir } from '@embroider/shared-internals';
import { NodeTemplateCompiler, throwOnWarnings } from '@embroider/core';
import { emberTemplateCompilerPath } from '@embroider/test-support';
import { Options as AdjustImportsOptions } from '@embroider/core/src/babel-plugin-adjust-imports';
import Resolver from '../src/resolver';
import { PackageRules } from '../src';
import type { TemplateCompilerPlugins } from '@embroider/core';
import type { AST, ASTPluginEnvironment } from '@glimmer/syntax';

const compilerPath = emberTemplateCompilerPath();
const compilerChecksum = `mock-compiler-checksum${Math.random()}`;

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

describe('compat-resolver', function () {
  let appDir: string;

  function configure(
    compatOptions: Options,
    otherOptions: {
      podModulePrefix?: string;
      adjustImportsImports?: Partial<AdjustImportsOptions>;
      plugins?: TemplateCompilerPlugins;
    } = {}
  ) {
    let EmberENV = {};
    let plugins: TemplateCompilerPlugins = otherOptions.plugins ?? { ast: [] };
    appDir = realpathSync(mkdtempSync(join(tmpdir, 'embroider-compat-tests-')));
    writeJSONSync(join(appDir, 'package.json'), { name: 'the-app' });
    let resolver = new Resolver({
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
          emberNeedsModulesPolyfill: false,
          appRoot: appDir,
        },
        otherOptions.adjustImportsImports
      ),
    });
    let compiler = new NodeTemplateCompiler({ compilerPath, compilerChecksum, resolver, EmberENV, plugins });
    return function (relativePath: string, contents: string) {
      let moduleName = givenFile(relativePath);
      let { dependencies } = compiler.precompile(contents, { filename: moduleName });
      return sortBy(dependencies, d => d.runtimeName).map(d => ({
        path: d.path,
        runtimeName: d.runtimeName,
      }));
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
    let findDependencies = configure({ staticComponents: false });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{hello-world}} <HelloWorld />`)).toEqual([]);
  });

  test('bare dasherized component, js only', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('nested bare dasherized component, js only', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/something/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{something/hello-world}}`)).toEqual([
      {
        path: '../components/something/hello-world.js',
        runtimeName: 'the-app/components/something/hello-world',
      },
    ]);
  });

  describe('bare namespaced', function () {
    test('dasherized component, js only', function () {
      let findDependencies = configure({ staticComponents: true });
      givenFile('components/hello-world/index.js');
      expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
        {
          path: '../components/hello-world/index.js',
          runtimeName: 'the-app/components/hello-world',
        },
      ]);
    });

    test('dasherized component, js and hbs', function () {
      let findDependencies = configure({ staticComponents: true });
      givenFile('components/hello-world/index.js');
      givenFile('components/hello-world/index.hbs');
      // the resolver only needs to handle the JS. Template-colocation causes
      // the JS to already import the HBS. That is also why we don't have a test
      // here for the hbs-only case -- from the resolver's perspective that case
      // doesn't exist, because we will have always synthesized the JS before
      // getting to the resolver.
      expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
        {
          path: '../components/hello-world/index.js',
          runtimeName: 'the-app/components/hello-world',
        },
      ]);
    });
  });

  test('podded, dasherized component, with blank podModulePrefix, js only', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world/component.js');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../components/hello-world/component.js',
        runtimeName: 'the-app/components/hello-world/component',
      },
    ]);
  });

  test('podded, dasherized component, with blank podModulePrefix, hbs only', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world/template.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../components/hello-world/template.hbs',
        runtimeName: 'the-app/components/hello-world/template',
      },
    ]);
  });

  test('podded, dasherized component, with blank podModulePrefix, js and hbs', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world/component.js');
    givenFile('components/hello-world/template.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../components/hello-world/component.js',
        runtimeName: 'the-app/components/hello-world/component',
      },
      {
        path: '../components/hello-world/template.hbs',
        runtimeName: 'the-app/components/hello-world/template',
      },
    ]);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, js only', function () {
    let findDependencies = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/component.js');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../pods/components/hello-world/component.js',
        runtimeName: 'the-app/pods/components/hello-world/component',
      },
    ]);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, hbs only', function () {
    let findDependencies = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/template.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../pods/components/hello-world/template.hbs',
        runtimeName: 'the-app/pods/components/hello-world/template',
      },
    ]);
  });

  test('podded, dasherized component, with non-blank podModulePrefix, js and hbs', function () {
    let findDependencies = configure({ staticComponents: true }, { podModulePrefix: 'the-app/pods' });
    givenFile('pods/components/hello-world/component.js');
    givenFile('pods/components/hello-world/template.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: '../pods/components/hello-world/component.js',
        runtimeName: 'the-app/pods/components/hello-world/component',
      },
      {
        path: '../pods/components/hello-world/template.hbs',
        runtimeName: 'the-app/pods/components/hello-world/template',
      },
    ]);
  });

  test('bare dasherized component, hbs only', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('templates/components/hello-world.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
      {
        path: './components/hello-world.hbs',
        runtimeName: 'the-app/templates/components/hello-world',
      },
    ]);
  });
  test('bare dasherized component, js and hbs', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('templates/components/hello-world.hbs');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([
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
  test('coalesces repeated components', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{hello-world}}{{hello-world}}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('tolerates non path mustaches', function () {
    let findDependencies = configure({ staticComponents: false, staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `<Thing @foo={{1}} />`)).toEqual([]);
  });

  test('block form curly component', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{#hello-world}} {{/hello-world}}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('block form angle component', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `<HelloWorld></HelloWorld>`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('curly contextual component', function () {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    givenFile('components/hello-world.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `{{#hello-world as |h|}} {{h.title flavor="chocolate"}} {{/hello-world}}`
      )
    ).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('angle contextual component, upper', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(
      findDependencies('templates/application.hbs', `<HelloWorld as |H|> <H.title @flavor="chocolate" /> </HelloWorld>`)
    ).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('angle contextual component, lower', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(
      findDependencies('templates/application.hbs', `<HelloWorld as |h|> <h.title @flavor="chocolate" /> </HelloWorld>`)
    ).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });

  test('optional component missing in mustache', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `{{this-one x=true}}`)).toEqual([]);
  });

  test('component rules can be expressed via component helper', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `{{this-one x=true}}`)).toEqual([]);
  });

  test('optional component missing in mustache block', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `{{#this-one}} {{/this-one}}`)).toEqual([]);
  });
  test('optional component missing in mustache', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `{{this-one x=true}}`)).toEqual([]);
  });
  test('optional component declared as element missing in mustache block', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `{{#this-one}} {{/this-one}}`)).toEqual([]);
  });
  test('optional component missing in element', function () {
    let findDependencies = configure({
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
    expect(findDependencies('templates/application.hbs', `<ThisOne/>`)).toEqual([]);
  });
  test('class defined helper not failing if there is no arguments', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{(this.myHelper)}}`)).toEqual([]);
  });
  test('class defined helper not failing with arguments', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{(this.myHelper 42)}}`)).toEqual([]);
  });
  test('helper defined in component not failing if there is no arguments', function () {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{#if (this.myHelper)}}{{/if}}`)).toEqual([]);
  });
  test('class defined component not failing if there is a block', function () {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{#this.myComponent}}hello{{/this.myComponent}}`)).toEqual(
      []
    );
  });
  test('class defined component not failing with arguments', function () {
    let findDependencies = configure({ staticComponents: true, staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{#this.myComponent 42}}{{/this.myComponent}}`)).toEqual([]);
  });
  test('mustache missing, no args', function () {
    let findDependencies = configure({
      staticComponents: true,
      staticHelpers: true,
    });
    expect(findDependencies('templates/application.hbs', `{{hello-world}}`)).toEqual([]);
  });
  test('mustache missing, with args', function () {
    let findDependencies = configure({
      staticComponents: true,
      staticHelpers: true,
    });
    expect(() => {
      findDependencies('templates/application.hbs', `{{hello-world foo=bar}}`);
    }).toThrow(new RegExp(`Missing component or helper: hello-world in templates/application.hbs`));
  });
  test('string literal passed to component helper in content position', function () {
    let findDependencies = configure({
      staticComponents: true,
    });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{component "hello-world"}}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });
  test('string literal passed to "helper" keyword in content position', function () {
    let findDependencies = configure({
      staticHelpers: true,
    });
    givenFile('helpers/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{helper "hello-world"}}`)).toEqual([
      {
        path: '../helpers/hello-world.js',
        runtimeName: 'the-app/helpers/hello-world',
      },
    ]);
  });
  test('string literal passed to "modifier" keyword in content position', function () {
    let findDependencies = configure({
      staticModifiers: true,
    });
    givenFile('modifiers/add-listener.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `<button {{(modifier "add-listener" "click" this.handleClick)}}>Test</button>`
      )
    ).toEqual([
      {
        path: '../modifiers/add-listener.js',
        runtimeName: 'the-app/modifiers/add-listener',
      },
    ]);
  });
  test('modifier currying using the "modifier" keyword', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/add-listener.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#let (modifier "add-listener") as |addListener|}}
          {{#let (modifier addListener "click") as |addClickListener|}}
            <button {{addClickListener this.handleClick}}>Test</button>
          {{/let}}
        {{/let}}
        `
      )
    ).toEqual([
      {
        path: '../modifiers/add-listener.js',
        runtimeName: 'the-app/modifiers/add-listener',
      },
    ]);
  });
  test('built-in components are ignored when used with the component helper', function () {
    let findDependencies = configure({
      staticComponents: true,
    });
    expect(
      findDependencies(
        'templates/application.hbs',
        `
      {{component "input"}}
      {{component "link-to"}}
      {{component "textarea"}}
    `
      )
    ).toEqual([]);
  });
  test('built-in helpers are ignored when used with the "helper" keyword', function () {
    let findDependencies = configure({
      staticHelpers: true,
    });
    expect(
      findDependencies(
        'templates/application.hbs',
        `
      {{helper "fn"}}
      {{helper "array"}}
      {{helper "concat"}}
    `
      )
    ).toEqual([]);
  });
  test('built-in modifiers are ignored when used with the "modifier" keyword', function () {
    let findDependencies = configure({
      staticModifiers: true,
    });
    expect(
      findDependencies(
        'templates/application.hbs',
        `
      <button {{(modifier "on" "click" this.handleClick)}}>Test</button>
      <button {{(modifier "action" "handleClick")}}>Test</button>
    `
      )
    ).toEqual([]);
  });
  test('component helper with direct addon package reference', function () {
    let findDependencies = configure({
      staticComponents: true,
    });
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(findDependencies('templates/application.hbs', `{{component "my-addon@thing"}}`)).toEqual([
      {
        path: '../node_modules/my-addon/components/thing.js',
        runtimeName: 'my-addon/components/thing',
      },
    ]);
  });
  test('component helper with direct addon package reference to a renamed package', function () {
    let findDependencies = configure(
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
    expect(findDependencies('templates/application.hbs', `{{component "has-been-renamed@thing"}}`)).toEqual([
      {
        path: '../node_modules/my-addon/components/thing.js',
        runtimeName: 'has-been-renamed/components/thing',
      },
    ]);
  });
  test('angle bracket invocation of component with @ syntax', function () {
    let findDependencies = configure(
      {
        staticComponents: true,
      },
      { plugins: { ast: [emberHolyFuturisticNamespacingBatmanTransform] } }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(findDependencies('templates/application.hbs', `<MyAddon$Thing />`)).toEqual([
      {
        path: '../node_modules/my-addon/components/thing.js',
        runtimeName: 'my-addon/components/thing',
      },
    ]);
  });
  test('angle bracket invocation of component with @ syntax - self reference inside node_modules', function () {
    let findDependencies = configure(
      {
        staticComponents: true,
      },
      { plugins: { ast: [emberHolyFuturisticNamespacingBatmanTransform] } }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/components/thing.js');
    expect(findDependencies('node_modules/my-addon/components/foo.hbs', `<MyAddon$Thing />`)).toEqual([
      {
        path: './thing.js',
        runtimeName: 'my-addon/components/thing',
      },
    ]);
  });
  test('helper with @ syntax', function () {
    let findDependencies = configure(
      {
        staticHelpers: true,
      },
      { plugins: { ast: [emberHolyFuturisticNamespacingBatmanTransform] } }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon" }`);
    givenFile('node_modules/my-addon/helpers/thing.js');
    expect(findDependencies('templates/application.hbs', `{{my-addon$thing}}`)).toEqual([
      {
        path: '../node_modules/my-addon/helpers/thing.js',
        runtimeName: 'my-addon/helpers/thing',
      },
    ]);
  });
  test('helper with @ syntax and direct addon package reference to a renamed package', function () {
    let findDependencies = configure(
      {
        staticHelpers: true,
      },
      {
        adjustImportsImports: {
          renamePackages: {
            'has-been-renamed': 'my-addon',
          },
        },
        plugins: { ast: [emberHolyFuturisticNamespacingBatmanTransform] },
      }
    );
    givenFile('node_modules/my-addon/package.json', `{ "name": "my-addon"}`);
    givenFile('node_modules/my-addon/helpers/thing.js');
    expect(findDependencies('templates/application.hbs', `{{has-been-renamed$thing}}`)).toEqual([
      {
        path: '../node_modules/my-addon/helpers/thing.js',
        runtimeName: 'has-been-renamed/helpers/thing',
      },
    ]);
  });
  test('string literal passed to component helper with block', function () {
    let findDependencies = configure({
      staticComponents: true,
    });
    givenFile('components/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{#component "hello-world"}} {{/component}}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
    ]);
  });
  test('string literal passed to component helper in helper position', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    givenFile('components/my-thing.js');
    expect(findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`)).toEqual([
      {
        path: '../components/hello-world.js',
        runtimeName: 'the-app/components/hello-world',
      },
      {
        path: '../components/my-thing.js',
        runtimeName: 'the-app/components/my-thing',
      },
    ]);
  });
  test('string literal passed to "helper" keyword in helper position', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/hello-world.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#let (helper "hello-world") as |helloWorld|}}
          {{helloWorld}}
        {{/let}}
        `
      )
    ).toEqual([
      {
        path: '../helpers/hello-world.js',
        runtimeName: 'the-app/helpers/hello-world',
      },
    ]);
  });
  test('helper currying using the "helper" keyword', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/hello-world.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#let (helper "hello-world" name="World") as |hello|}}
          {{#let (helper hello name="Tomster") as |helloTomster|}}
            {{helloTomster name="Zoey"}}
          {{/let}}
        {{/let}}
        `
      )
    ).toEqual([
      {
        path: '../helpers/hello-world.js',
        runtimeName: 'the-app/helpers/hello-world',
      },
    ]);
  });
  test('string literal passed to "modifier" keyword in helper position', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/add-listener.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `
        {{#let (modifier "add-listener" "click") as |addClickListener|}}
          <button {{addClickListener this.handleClick}}>Test</button>
        {{/let}}
        `
      )
    ).toEqual([
      {
        path: '../modifiers/add-listener.js',
        runtimeName: 'the-app/modifiers/add-listener',
      },
    ]);
  });
  test('string literal passed to component helper fails to resolve', function () {
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/my-thing.js');
    expect(() => {
      findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`);
    }).toThrow(new RegExp(`Missing component: hello-world in templates/application.hbs`));
  });
  test('string literal passed to "helper" keyword fails to resolve', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{helper "hello-world"}}`);
    }).toThrow(new RegExp(`Missing helper: hello-world in templates/application.hbs`));
  });
  test('string literal passed to "modifier" keyword fails to resolve', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(() => {
      findDependencies(
        'templates/application.hbs',
        `<button {{(modifier "add-listener" "click" this.handleClick)}}>Test</button>`
      );
    }).toThrow(new RegExp(`Missing modifier: add-listener in templates/application.hbs`));
  });
  test('string literal passed to component helper fails to resolve when staticComponents is off', function () {
    let findDependencies = configure({ staticComponents: false });
    givenFile('components/my-thing.js');
    expect(findDependencies('templates/application.hbs', `{{my-thing header=(component "hello-world") }}`)).toEqual([]);
  });
  test('string literal passed to "helper" keyword fails to resolve when staticHelpers is off', function () {
    let findDependencies = configure({ staticHelpers: false });
    givenFile('helpers/hello-world.js');
    expect(findDependencies('templates/application.hbs', `{{helper "hello-world"}}`)).toEqual([]);
  });
  test('string literal passed to "modifier" keyword fails to resolve when staticModifiers is off', function () {
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
    let findDependencies = configure({ staticComponents: true });
    givenFile('components/hello-world.js');
    expect(() => {
      findDependencies('templates/application.hbs', `{{component this.which}}`);
    }).toThrow(/Unsafe dynamic component: this\.which in templates\/application\.hbs/);
  });
  test('angle component, js and hbs', function () {
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
  test('nested angle component, js and hbs', function () {
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
  test('angle component missing', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(() => {
      findDependencies('templates/application.hbs', `<HelloWorld />`);
    }).toThrow(new RegExp(`Missing component: HelloWorld in templates/application.hbs`));
  });
  test('helper in subexpression', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    expect(findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`)).toEqual(
      [
        {
          runtimeName: 'the-app/helpers/array',
          path: '../helpers/array.js',
        },
      ]
    );
  });
  test('missing subexpression with args', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{#each (things 1 2 3) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test('missing subexpression no args', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `{{#each (things) as |num|}} {{num}} {{/each}}`);
    }).toThrow(new RegExp(`Missing helper: things in templates/application.hbs`));
  });
  test('emits no helpers when staticHelpers is off', function () {
    let findDependencies = configure({ staticHelpers: false });
    givenFile('helpers/array.js');
    expect(findDependencies('templates/application.hbs', `{{#each (array 1 2 3) as |num|}} {{num}} {{/each}}`)).toEqual(
      []
    );
  });
  test('helper as component argument', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/array.js');
    expect(findDependencies('templates/application.hbs', `{{my-component value=(array 1 2 3) }}`)).toEqual([
      {
        runtimeName: 'the-app/helpers/array',
        path: '../helpers/array.js',
      },
    ]);
  });
  test('helper as html attribute', function () {
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
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(findDependencies('templates/application.hbs', `{{capitalize}}`)).toEqual([
      {
        runtimeName: 'the-app/helpers/capitalize',
        path: '../helpers/capitalize.js',
      },
    ]);
  });
  test('helper in bare mustache, with args', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(findDependencies('templates/application.hbs', `{{capitalize name}}`)).toEqual([
      {
        runtimeName: 'the-app/helpers/capitalize',
        path: '../helpers/capitalize.js',
      },
    ]);
  });
  test('missing modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(() => {
      findDependencies('templates/application.hbs', `<canvas {{fancy-drawing}}></canvas>`);
    }).toThrow(new RegExp(`Missing modifier: fancy-drawing in templates/application.hbs`));
  });
  test('emits no modifiers when staticModifiers is off', function () {
    let findDependencies = configure({ staticModifiers: false });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<input {{auto-focus}} />`)).toEqual([]);
  });
  test('modifier on html element', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<input {{auto-focus}} />`)).toEqual([
      {
        runtimeName: 'the-app/modifiers/auto-focus',
        path: '../modifiers/auto-focus.js',
      },
    ]);
  });
  test('modifier on component', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<StyledInput {{auto-focus}} />`)).toEqual([
      {
        runtimeName: 'the-app/modifiers/auto-focus',
        path: '../modifiers/auto-focus.js',
      },
    ]);
  });
  test('modifier on contextual component', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<Form as |f|> <f.Input {{auto-focus}} /></Form>`)).toEqual([
      {
        runtimeName: 'the-app/modifiers/auto-focus',
        path: '../modifiers/auto-focus.js',
      },
    ]);
  });
  test('modifier provided as an argument', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('components/test.hbs', `<input {{@auto-focus}} />`)).toEqual([]);
  });
  test('contextual modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/auto-focus.js');
    expect(findDependencies('templates/application.hbs', `<Form as |f|> <input {{f.auto-focus}} /></Form>`)).toEqual(
      []
    );
  });
  test('local binding takes precedence over helper in bare mustache', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(
      findDependencies('templates/application.hbs', `{{#each things as |capitalize|}} {{capitalize}} {{/each}}`)
    ).toEqual([]);
  });
  test('local binding takes precedence over component in element position', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('components/the-thing.js');
    expect(
      findDependencies('templates/application.hbs', `{{#each things as |TheThing|}} <TheThing /> {{/each}}`)
    ).toEqual([]);
  });
  test('local binding takes precedence over modifier', function () {
    let findDependencies = configure({ staticModifiers: true });
    givenFile('modifiers/some-modifier.js');
    expect(
      findDependencies(
        'templates/application.hbs',
        `{{#each modifiers as |some-modifier|}} <div {{some-modifier}}></div> {{/each}}`
      )
    ).toEqual([]);
  });
  test('angle components can establish local bindings', function () {
    let findDependencies = configure({ staticHelpers: true });
    givenFile('helpers/capitalize.js');
    expect(findDependencies('templates/application.hbs', `<Outer as |capitalize|> {{capitalize}} </Outer>`)).toEqual(
      []
    );
  });
  test('local binding only applies within block', function () {
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
  test('ignores builtins', function () {
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

  test('ignores dot-rule curly component invocation, inline', function () {
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
  test('ignores dot-rule curly component invocation, block', function () {
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(
      findDependencies('templates/application.hbs', `{{#form-builder title="fancy-title"}} {{/form-builder}}`)
    ).toEqual([
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(findDependencies('templates/application.hbs', `<FormBuilder @title={{component "fancy-title"}} />`)).toEqual(
      [
        {
          runtimeName: 'the-app/templates/components/fancy-title',
          path: './components/fancy-title.hbs',
        },
        {
          runtimeName: 'the-app/templates/components/form-builder',
          path: './components/form-builder.hbs',
        },
      ]
    );
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('components/form-builder.js');
    expect(findDependencies('components/form-builder.hbs', `{{component title}}`)).toEqual([]);
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(findDependencies('templates/application.hbs', `<FormBuilder @title={{"fancy-title"}} />`)).toEqual([
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    givenFile('templates/components/fancy-title.hbs');
    expect(findDependencies('templates/application.hbs', `<FormBuilder @title="fancy-title" />`)).toEqual([
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component title}}`)).toEqual([]);
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component this.title}}`)).toEqual([]);
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/form-builder.hbs', `{{component @title}}`)).toEqual([]);
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    expect(findDependencies('templates/components/x.hbs', `<FormBuilder />`)).toEqual([]);
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
    let findDependencies = configure({ staticComponents: true, packageRules });
    givenFile('templates/components/form-builder.hbs');
    expect(findDependencies('templates/components/x.hbs', `<FormBuilder />`)).toEqual([
      {
        path: './form-builder.hbs',
        runtimeName: 'the-app/templates/components/form-builder',
      },
    ]);
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

  test('rejects arbitrary expression in component helper', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(() => findDependencies('templates/application.hbs', `{{component (some-helper this.which) }}`)).toThrow(
      `Unsafe dynamic component: cannot statically analyze this expression`
    );
  });

  test('ignores any non-string-literal in "helper" keyword', function () {
    let findDependencies = configure({ staticHelpers: true });
    expect(findDependencies('templates/application.hbs', `{{helper this.which}}`)).toEqual([]);
  });

  test('ignores any non-string-literal in "modifier" keyword', function () {
    let findDependencies = configure({ staticModifiers: true });
    expect(findDependencies('templates/application.hbs', `<div {{(modifier this.which)}}></div>`)).toEqual([]);
  });

  test('trusts inline ensure-safe-component helper', function () {
    let findDependencies = configure({ staticComponents: true });
    expect(findDependencies('templates/application.hbs', `{{component (ensure-safe-component this.which) }}`)).toEqual(
      []
    );
  });
});
