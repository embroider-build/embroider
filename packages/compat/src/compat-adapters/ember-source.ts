import V1Addon from '../v1-addon';
import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import AddToTree from '../add-to-tree';
import { outputFileSync, readFileSync, readdirSync, unlinkSync } from 'fs-extra';
import { join, resolve } from 'path';
import { Memoize } from 'typescript-memoize';
import { satisfies } from 'semver';
import { transform } from '@babel/core';
import type * as Babel from '@babel/core';
import type { NodePath } from '@babel/traverse';
import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { existsSync } from 'fs';

export default class extends V1Addon {
  get v2Tree() {
    return mergeTrees([super.v2Tree, buildFunnel(this.rootTree, { include: ['dist/ember-template-compiler.js'] })]);
  }

  // versions of ember-source prior to
  // https://github.com/emberjs/ember.js/pull/20675 ship dist/packages and
  // dist/dependencies separately and the imports between them are package-name
  // imports. Since many of the dependencies are also true package.json
  // dependencies (in order to get typescript types), and our module-resolver
  // prioritizes true dependencies, it's necessary to detect and remove the
  // package.json dependencies.
  //
  // After the above linked change, ember-source ships only dist/packages and
  // the inter-package imports are all relative. Some of the things in
  // dist/packages are still the rolled-in dependencies, but now that the
  // imports are all relative we need no special handling for them (beyond the
  // normal v2 addon renamed-modules support.
  @Memoize()
  private get includedDependencies() {
    let result: string[] = [];
    let depsDir = resolve(this.root, 'dist', 'dependencies');
    if (!existsSync(depsDir)) {
      return result;
    }
    for (let name of readdirSync(depsDir)) {
      if (name[0] === '@') {
        for (let innerName of readdirSync(resolve(this.root, 'dist', 'dependencies', name))) {
          if (innerName.endsWith('.js')) {
            result.push(name + '/' + innerName.slice(0, -3));
          }
        }
      } else {
        if (name.endsWith('.js')) {
          result.push(name.slice(0, -3));
        }
      }
    }
    return result;
  }

  get newPackageJSON() {
    let json = super.newPackageJSON;

    for (let name of this.includedDependencies) {
      // weirdly, many of the inlined dependency are still listed as real
      // dependencies too. If we don't delete them here, they will take
      // precedence over the inlined ones, because the embroider module-resolver
      // tries to prioritize real deps.
      delete json.dependencies?.[name];
    }

    return json;
  }

  customizes(treeName: string) {
    // we are adding custom implementations of these
    return treeName === 'treeForAddon' || treeName === 'treeForVendor' || super.customizes(treeName);
  }

  invokeOriginalTreeFor(name: string) {
    if (name === 'addon') {
      return this.customAddonTree();
    }
    if (name === 'vendor') {
      return this.customVendorTree();
    }
  }

  // Our addon tree is all of the "packages" we share. @embroider/compat already
  // supports that pattern of emitting modules into other package's namespaces.
  private customAddonTree() {
    let packages = buildFunnel(this.rootTree, {
      srcDir: 'dist/packages',
    });

    let trees: Node[] = [
      packages,
      buildFunnel(this.rootTree, {
        srcDir: 'dist/dependencies',
        allowEmpty: true,
      }),
    ];

    if (satisfies(this.packageJSON.version, '>= 4.0.0-alpha.0 <4.10.0-alpha.0', { includePrerelease: true })) {
      // import { loc } from '@ember/string' was removed in 4.0. but the
      // top-level `ember` package tries to import it until 4.10. A
      // spec-compliant ES modules implementation will treat this as a parse
      // error.
      trees.push(new ReplaceRequire([new FixStringLoc([packages])]));
    } else if (satisfies(this.packageJSON.version, '<5.7.0')) {
      trees.push(new ReplaceRequire([packages]));
    }

    if (satisfies(this.packageJSON.version, '<5.12.0')) {
      trees.push(new FixDeprecateFunction([packages]));
    }

    if (satisfies(this.packageJSON.version, '<5.11.1')) {
      trees.push(new FixCycleImports([packages]));
    }

    return mergeTrees(trees, { overwrite: true });
  }

  // We're zeroing out these files in vendor rather than deleting them, because
  // we can't easily intercept the `app.import` that presumably exists for them,
  // so rather than error they will just be empty.
  //
  // The reason we're zeroing these out is that we're going to consume all our
  // modules directly out of treeForAddon instead, as real modules that webpack
  // can see.
  private customVendorTree() {
    return new AddToTree(this.addonInstance._treeFor('vendor'), outputPath => {
      unlinkSync(join(outputPath, 'ember', 'ember.js'));
      outputFileSync(join(outputPath, 'ember', 'ember.js'), '');
      unlinkSync(join(outputPath, 'ember', 'ember-testing.js'));
      outputFileSync(join(outputPath, 'ember', 'ember-testing.js'), '');
    });
  }

  get packageMeta() {
    let meta = super.packageMeta;

    if (!meta['implicit-modules']) {
      meta['implicit-modules'] = [];
    }
    meta['implicit-modules'].push('./ember/index.js');
    // before 5.6, Ember uses the AMD loader to decide if it's test-only parts
    // are present, so we must ensure they're registered. After that it's
    // enough to evaluate ember-testing, which @embroider/core is hard-coded
    // to do in the backward-compatible tests bundle.
    if (!satisfies(this.packageJSON.version, '>= 5.6.0-alpha.0', { includePrerelease: true })) {
      if (!meta['implicit-test-modules']) {
        meta['implicit-test-modules'] = [];
      }
      meta['implicit-test-modules'].push('./ember-testing/index.js');
    }

    return meta;
  }
}

class FixStringLoc extends Plugin {
  build() {
    let inSource = readFileSync(resolve(this.inputPaths[0], 'ember', 'index.js'), 'utf8');
    let outSource = transform(inSource, {
      plugins: [fixStringLoc],
      configFile: false,
    })!.code!;
    outputFileSync(resolve(this.outputPath, 'ember', 'index.js'), outSource, 'utf8');
  }
}

class ReplaceRequire extends Plugin {
  build() {
    updateFileWithTransform(this, 'ember/index.js', function (babel: typeof Babel) {
      const { types: t } = babel;

      function createLoader() {
        return t.objectExpression([
          t.objectMethod(
            'get',
            t.identifier('require'),
            [],
            t.blockStatement([
              t.returnStatement(t.memberExpression(t.identifier('globalThis'), t.identifier('require'))),
            ])
          ),
          t.objectMethod(
            'get',
            t.identifier('define'),
            [],
            t.blockStatement([
              t.returnStatement(t.memberExpression(t.identifier('globalThis'), t.identifier('define'))),
            ])
          ),
          t.objectMethod(
            'get',
            t.identifier('registry'),
            [],

            t.blockStatement([
              t.returnStatement(
                t.logicalExpression(
                  '??',
                  t.optionalMemberExpression(
                    t.memberExpression(t.identifier('globalThis'), t.identifier('requirejs')),
                    t.identifier('entries'),
                    false,
                    true
                  ),
                  t.optionalMemberExpression(
                    t.memberExpression(t.identifier('globalThis'), t.identifier('require')),
                    t.identifier('entries'),
                    false,
                    true
                  )
                )
              ),
            ])
          ),
        ]);
      }

      return {
        visitor: {
          CallExpression(path: NodePath<Babel.types.CallExpression>) {
            if (
              path.node.callee.type === 'Identifier' &&
              (path.node.callee.name === 'has' || path.node.callee.name === 'require') &&
              path.node.arguments[0].type === 'StringLiteral' &&
              path.node.arguments[0].value === 'ember-testing'
            ) {
              path.replaceWith(t.identifier('EmberTestingImpl'));
            }
          },
          ImportDeclaration(path: NodePath<Babel.types.ImportDeclaration>) {
            if (path.node.source.value === 'require') {
              path.replaceWith(
                t.importDeclaration(
                  [t.importSpecifier(t.identifier('EmberTestingImpl'), t.identifier('_impl'))],
                  t.stringLiteral('@ember/test')
                )
              );
            }
          },
          VariableDeclaration(path: NodePath<Babel.types.VariableDeclaration>) {
            if (
              path.node.declarations[0].id.type === 'Identifier' &&
              path.node.declarations[0].id.name === 'PartialEmber' &&
              path.node.declarations[0].init!.type === 'ObjectExpression'
            ) {
              const declaration = path.node.declarations[0];
              const loader = (declaration.init! as Babel.types.ObjectExpression).properties.find(
                p => (p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name) === '__loader'
              );
              (loader as Babel.types.ObjectProperty).value = createLoader();
            }
          },
          AssignmentExpression(path: NodePath<Babel.types.AssignmentExpression>) {
            if (
              path.node.left.type === 'MemberExpression' &&
              path.node.left.object.type === 'Identifier' &&
              path.node.left.object.name === 'Ember' &&
              path.node.left.property.type === 'Identifier' &&
              path.node.left.property.name === '__loader'
            ) {
              path.node.right = createLoader();
            }
          },
        },
      };
    });

    replaceFile(
      this,
      '@ember/test/adapter.js',
      `import { Adapter } from 'ember-testing';
      export default Adapter;`
    );

    replaceFile(
      this,
      '@ember/test/index.js',
      `export let registerAsyncHelper;
export let registerHelper;
export let registerWaiter;
export let unregisterHelper;
export let unregisterWaiter;
export let _impl;

let testingNotAvailableMessage = () => {
  throw new Error('Attempted to use test utilities, but \`ember-testing\` was not included');
};

registerAsyncHelper = testingNotAvailableMessage;
registerHelper = testingNotAvailableMessage;
registerWaiter = testingNotAvailableMessage;
unregisterHelper = testingNotAvailableMessage;
unregisterWaiter = testingNotAvailableMessage;

export function registerTestImplementaiton(impl) {
  let { Test } = impl;
  registerAsyncHelper = Test.registerAsyncHelper;
  registerHelper = Test.registerHelper;
  registerWaiter = Test.registerWaiter;
  unregisterHelper = Test.unregisterHelper;
  unregisterWaiter = Test.unregisterWaiter;
  _impl = impl;
}`
    );

    replaceFile(
      this,
      'ember-testing/index.js',
      `export * from './lib/public-api';
import * as EmberTesting from './lib/public-api';
import { registerTestImplementaiton } from '@ember/test';


registerTestImplementaiton(EmberTesting);`
    );

    replaceFile(
      this,
      'ember-testing/lib/public-api.js',
      `
export { default as Test } from './test';
export { default as Adapter } from './adapters/adapter';
export { default as setupForTesting } from './setup_for_testing';
export { default as QUnitAdapter } from './adapters/qunit';

import './ext/application';
import './ext/rsvp'; // setup RSVP + run loop integration
import './helpers'; // adds helpers to helpers object in Test
import './initializers'; // to setup initializer`
    );
  }
}

class FixDeprecateFunction extends Plugin {
  build() {
    let inSource = readFileSync(resolve(this.inputPaths[0], '@ember', 'debug', 'index.js'), 'utf8');
    let outSource = transform(inSource, {
      plugins: [fixDeprecate],
      configFile: false,
    })!.code!;
    outputFileSync(resolve(this.outputPath, '@ember', 'debug', 'index.js'), outSource, 'utf8');
  }
}

function fixDeprecate(babel: typeof Babel) {
  const { types: t } = babel;

  return {
    name: 'ast-transform', // not required
    visitor: {
      Program(path: NodePath<Babel.types.Program>) {
        path.node.body.unshift(
          t.functionDeclaration(
            t.identifier('newDeprecate'),
            [t.restElement(t.identifier('rest'))],
            t.blockStatement([
              t.returnStatement(
                t.callExpression(
                  t.logicalExpression('??', t.identifier('currentDeprecate'), t.identifier('_deprecate')),
                  [t.spreadElement(t.identifier('rest'))]
                )
              ),
            ])
          )
        );
      },
      AssignmentExpression(path: NodePath<Babel.types.AssignmentExpression>) {
        if (path.node.left.type === 'Identifier' && path.node.left.name === 'deprecate') {
          path.node.left.name = 'currentDeprecate';
        }
      },

      ReturnStatement(path: NodePath<Babel.types.ReturnStatement>) {
        if (path.node.argument?.type === 'Identifier' && path.node.argument.name === 'deprecate') {
          path.node.argument.name = 'newDeprecate';
        }
      },

      CallExpression(path: NodePath<Babel.types.CallExpression>) {
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'deprecate') {
          path.node.callee.name = 'newDeprecate';
        }
        if (
          path.node.callee.type === 'Identifier' &&
          path.node.callee.name === 'setDebugFunction' &&
          path.node.arguments[0].type === 'StringLiteral' &&
          path.node.arguments[0].value === 'deprecate'
        ) {
          path.remove();
        }
      },
      ExportSpecifier(path: NodePath<Babel.types.ExportSpecifier>) {
        if (path.node.local.name === 'deprecate') {
          path.node.local = t.identifier('newDeprecate');
        }
      },
      VariableDeclarator(path: NodePath<Babel.types.VariableDeclarator>) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'deprecate') {
          path.node.id.name = 'currentDeprecate';
          path.node.init = null; // leave undefined for newDeprecate's (currentDeprecate ?? _deprecated) expression
        }
      },
    },
  };
}

function updateFileWithTransform(
  context: Plugin,
  file: string,
  transformFunction: Babel.PluginItem | Babel.PluginItem[]
) {
  // only update the file if it exists - this helps the codemods to work across many different versions
  if (!existsSync(resolve(context.inputPaths[0], file))) {
    return;
  }
  let inSource = readFileSync(resolve(context.inputPaths[0], file), 'utf8');

  let plugins = Array.isArray(transformFunction) ? transformFunction : [transformFunction];
  let outSource = transform(inSource, {
    plugins,
    configFile: false,
  })!.code!;
  outputFileSync(resolve(context.outputPath, file), outSource, 'utf8');
}

function replaceFile(context: Plugin, file: string, content: string) {
  outputFileSync(resolve(context.outputPath, file), content, 'utf8');
}

class FixCycleImports extends Plugin {
  build() {
    for (let file of ['@ember/object/observable.js', '@ember/utils/lib/is_empty.js']) {
      updateFileWithTransform(this, file, moveObjectSpecifiersToMetal);
    }

    updateFileWithTransform(this, '@ember/array/index.js', [
      moveObjectSpecifiersToMetal,
      function (babel: typeof Babel) {
        const { types: t } = babel;
        return {
          visitor: {
            ExportNamedDeclaration(path: NodePath<Babel.types.ExportNamedDeclaration>) {
              if (path.node.source?.value === './lib/make-array') {
                path.node.source = t.stringLiteral('./make');
              }
            },
          },
        };
      },
    ]);

    updateFileWithTransform(this, '@ember/runloop/index.js', function (babel: typeof Babel) {
      const { types: t } = babel;

      return {
        visitor: {
          CallExpression(path: NodePath<Babel.types.CallExpression>) {
            if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'flushAsyncObservers') {
              path.node.arguments = [t.identifier('schedule')];
            }
          },
        },
      };
    });

    updateFileWithTransform(this, '@ember/object/core.js', function (babel: typeof Babel) {
      const { types: t } = babel;

      return {
        visitor: {
          ImportDeclaration(path: NodePath<Babel.types.ImportDeclaration>) {
            if (path.node.source.value === '@ember/array') {
              path.node.source = t.stringLiteral('@ember/array/make');
              path.node.specifiers = [t.importDefaultSpecifier(t.identifier('makeArray'))];
            }

            if (path.node.source.value === '@ember/-internals/runtime') {
              path.replaceWith(
                t.importDeclaration(
                  [t.importSpecifier(t.identifier('ActionHandler'), t.identifier('default'))],
                  t.stringLiteral('@ember/-internals/runtime/lib/mixins/action_handler')
                )
              );
            }
          },
        },
      };
    });

    outputFileSync(
      resolve(this.outputPath, '@ember/array/make.js'),
      `export { default } from './lib/make-array';`,
      'utf8'
    );

    updateFileWithTransform(this, '@ember/-internals/metal/index.js', function (babel: typeof Babel) {
      const { types: t } = babel;

      return {
        visitor: {
          FunctionDeclaration(path: NodePath<Babel.types.FunctionDeclaration>) {
            if (path.node.id?.name === 'flushAsyncObservers') {
              path.node.params = [t.identifier('_schedule')];
            }
          },
          IfStatement(path: NodePath<Babel.types.IfStatement>) {
            if (path.node.test.type === 'Identifier' && path.node.test.name === 'shouldSchedule') {
              path.node.test.name = '_schedule';
            }
          },
          CallExpression(path: NodePath<Babel.types.CallExpression>) {
            if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'schedule') {
              path.node.callee.name = '_schedule';
            }
          },
          ImportDeclaration(path: NodePath<Babel.types.ImportDeclaration>) {
            if (path.node.source.value === '@ember/runloop') {
              path.remove();
            }
          },
        },
      };
    });
  }
}

function moveObjectSpecifiersToMetal() {
  let done = false;

  return {
    visitor: {
      ImportDeclaration(path: NodePath<Babel.types.ImportDeclaration>) {
        if (path.node.source.value === '@ember/-internals/metal') {
          if (done) {
            return;
          }

          /**
           * I need to use getAllPRevSiblings and getAllNextSiblings here because I need the siblings
           * to be paths and path.container only holds nodes (for some strange reason).
           */
          const objectimport = [...path.getAllPrevSiblings(), ...path.getAllNextSiblings()].find(
            p => p.node.type === 'ImportDeclaration' && p.node.source.value === '@ember/object'
          ) as NodePath<Babel.types.ImportDeclaration>;

          path.node.specifiers.push(...objectimport!.node.specifiers);
          objectimport.remove();

          done = true;
        }
      },
    },
  };
}

function fixStringLoc(babel: typeof Babel) {
  let t = babel.types;
  return {
    visitor: {
      Program(path: NodePath<Babel.types.Program>) {
        path.node.body.unshift(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier('loc'), t.identifier('undefined'))])
        );
      },
      ImportDeclaration: {
        enter(path: NodePath<Babel.types.ImportDeclaration>, state: { inEmberString: boolean }) {
          if (path.node.source.value === '@ember/string') {
            state.inEmberString = true;
          }
        },
        exit(_path: NodePath<Babel.types.ImportDeclaration>, state: { inEmberString: boolean }) {
          state.inEmberString = false;
        },
      },
      ImportSpecifier(path: NodePath<Babel.types.ImportSpecifier>, state: { inEmberString: boolean }) {
        let name = 'value' in path.node.imported ? path.node.imported.value : path.node.imported.name;
        if (state.inEmberString && name === 'loc') {
          path.remove();
        }
      },
    },
  };
}
