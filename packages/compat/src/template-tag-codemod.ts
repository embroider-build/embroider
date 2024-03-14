import { default as compatBuild } from './default-pipeline';
import type { EmberAppInstance } from '@embroider/core';
import type { Node, InputNode } from 'broccoli-node-api';
import { join, relative, resolve } from 'path';
import type { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { statSync, readdirSync, readFileSync } from 'fs';
import Plugin from 'broccoli-plugin';
import { transformSync } from '@babel/core';
import { hbsToJS, ResolverLoader } from '@embroider/core';
import { ImportUtil } from 'babel-import-util';
import ResolverTransform from './resolver-transform';
export interface TemplateTagCodemodOptions {
  shouldTransformPath: (outputPath: string) => boolean;
}

export default function templateTagCode(
  emberApp: EmberAppInstance,
  options: TemplateTagCodemodOptions = { shouldTransformPath: () => true }
): Node {
  return new TemplateTagCodemodPlugin(
    [
      compatBuild(emberApp, undefined, {
        staticAddonTrees: true,
        staticAddonTestSupportTrees: true,
        staticComponents: true,
        staticHelpers: true,
        staticModifiers: true,
        staticEmberSource: true,
        amdCompatibility: {
          es: [],
        },
      }),
    ],
    options
  );
}
class TemplateTagCodemodPlugin extends Plugin {
  constructor(inputNodes: InputNode[], readonly options: TemplateTagCodemodOptions) {
    super(inputNodes, {
      name: 'TemplateTagCodemodPlugin',
    });
  }
  async build() {
    function* walkSync(dir: string): Generator<string> {
      const files = readdirSync(dir);

      for (const file of files) {
        const pathToFile = join(dir, file);
        const isDirectory = statSync(pathToFile).isDirectory();
        if (isDirectory) {
          yield* walkSync(pathToFile);
        } else {
          yield pathToFile;
        }
      }
    }
    this.inputPaths[0];
    const tmp_path = readFileSync(this.inputPaths[0] + '/.stage2-output').toLocaleString();
    const compatPattern = /#embroider_compat\/(?<type>[^\/]+)\/(?<rest>.*)/;
    const resolver = new ResolverLoader(__dirname).resolver;
    const hbs_file_test = /\/rewritten-app\/components\/.*\.hbs$/;

    for await (const p of walkSync(tmp_path)) {
      if (hbs_file_test.test(p) && this.options.shouldTransformPath(p)) {
        const template_file_src = readFileSync(p).toLocaleString();
        const ember_template_compiler = resolver.nodeResolve(
          'ember-source/vendor/ember/ember-template-compiler',
          resolve(__dirname, 'package.json')
        );
        if (ember_template_compiler.type === 'not_found') {
          throw 'This will not ever be true';
        }

        let src =
          transformSync(hbsToJS(template_file_src), {
            plugins: [
              [
                'babel-plugin-ember-template-compilation',
                {
                  compilerPath: ember_template_compiler.filename,
                  transforms: [ResolverTransform({ appRoot: __dirname })],
                  targetFormat: 'hbs',
                },
              ],
            ],
          })?.code ?? '';

        const import_bucket: NodePath<t.ImportDeclaration>[] = [];
        let transformed_template_value = '';
        transformSync(src, {
          plugins: [
            function template_tag_extractor(): unknown {
              return {
                visitor: {
                  ImportDeclaration(import_declaration: NodePath<t.ImportDeclaration>) {
                    // if (import_declaration.node.source.value.indexOf('@ember/template-compilation') !== -1) {
                    //   import_declaration.remove();
                    //   return;
                    // }
                    const extractor = import_declaration.node.source.value.match(compatPattern);
                    if (extractor) {
                      const result = resolver.nodeResolve(extractor[0], p);
                      if (result.type === 'real') {
                        // find package
                        const owner_package = resolver.packageCache.ownerOfFile(result.filename);
                        // change import to real one
                        import_declaration.node.source.value =
                          owner_package!.name + '/' + extractor[1] + '/' + extractor[2];
                        import_bucket.push(import_declaration);
                      }
                    } else if (import_declaration.node.source.value.indexOf('@ember/template-compilation') === -1) {
                      import_bucket.push(import_declaration);
                    }
                  },
                  CallExpression(path: NodePath<t.CallExpression>) {
                    // reverse of hbs to js
                    // extract the template string to put into template tag in backing class
                    if (
                      'name' in path.node.callee &&
                      path.node.callee.name === 'precompileTemplate' &&
                      path.node.arguments &&
                      'value' in path.node.arguments[0]
                    ) {
                      transformed_template_value = `<template>\n\t${path.node.arguments[0].value}\n</template>`;
                    }
                  },
                },
              };
            },
          ],
        });
        //find backing class
        const backing_class_resolution = resolver.nodeResolve(
          '#embroider_compat/' + relative(tmp_path, p).slice(0, -4),
          tmp_path
        );

        const backing_class_src =
          'filename' in backing_class_resolution ? readFileSync(backing_class_resolution.filename).toString() : '';
        // console.log(backing_class_src);
        const magic_string = '__MAGIC_STRING_FOR_TEMPLATE_TAG_REPLACE__';
        src = transformSync(backing_class_src, {
          plugins: [
            ['@babel/plugin-syntax-decorators', { decoratorsBeforeExport: true }],
            function glimmer_syntax_creator(babel): unknown {
              return {
                name: 'test',
                visitor: {
                  Program: {
                    enter(path: NodePath<t.Program>) {
                      // Always instantiate the ImportUtil instance at the Program scope
                      const importUtil = new ImportUtil(babel.types, path);
                      const first_node = path.get('body')[0];
                      if (
                        first_node &&
                        first_node.node &&
                        first_node.node.leadingComments &&
                        first_node.node.leadingComments[0]?.value.includes('__COLOCATED_TEMPLATE__')
                      ) {
                        //remove magic comment
                        first_node.node.leadingComments.splice(0, 1);
                      }
                      for (const template_import of import_bucket) {
                        for (let i = 0, len = template_import.node.specifiers.length; i < len; ++i) {
                          const specifier = template_import.node.specifiers[i];
                          if (specifier.type === 'ImportDefaultSpecifier') {
                            importUtil.import(path, template_import.node.source.value, 'default', specifier.local.name);
                          } else if (specifier.type === 'ImportSpecifier') {
                            importUtil.import(path, template_import.node.source.value, specifier.local.name);
                          }
                        }
                      }
                    },
                  },
                  ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
                    path.traverse({
                      ClassBody(path) {
                        const classbody_nodes = path.get('body');
                        //add magic string to be replaces with the contents of the template tag
                        classbody_nodes[classbody_nodes.length - 1].addComment('trailing', magic_string, false);
                      },
                    });
                  },
                },
              };
            },
          ],
        })!.code!.replace(`/*${magic_string}*/`, transformed_template_value);
        // TODO git rm old files
        // work out original file path in app tree
        // write glimmer file out
        // console.log('transformed+++++++++++++++++++++++++++++++++++++\n\n', src);
      }
    }
  }
}
