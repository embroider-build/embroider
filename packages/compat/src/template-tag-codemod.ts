import { default as compatBuild } from './default-pipeline';
import type { EmberAppInstance } from '@embroider/core';
import type { Node, InputNode } from 'broccoli-node-api';
import { join, relative, resolve, extname } from 'path';
import type { types as t } from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { statSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import Plugin from 'broccoli-plugin';
import { transformSync } from '@babel/core';
import { hbsToJS, ResolverLoader } from '@embroider/core';
import ResolverTransform, { type ExternalNameHint } from './resolver-transform';
import { spawn } from 'child_process';
import { locateEmbroiderWorkingDir } from '@embroider/core';

export interface TemplateTagCodemodOptions {
  shouldTransformPath: (outputPath: string) => boolean;
  nameHint: ExternalNameHint;
  dryRun: boolean;
}

export default function templateTagCodemod(
  emberApp: EmberAppInstance,
  {
    shouldTransformPath = (() => true) as TemplateTagCodemodOptions['shouldTransformPath'],
    nameHint = (path => {
      return path
        .split('/')
        .map(part =>
          part
            .split('-')
            // capitalize first letter
            .map(inner_part => inner_part.charAt(0).toUpperCase() + inner_part.slice(1))
            .join('')
        )
        .join('_');
    }) as TemplateTagCodemodOptions['nameHint'],
    dryRun = false,
  } = {}
): Node {
  return new TemplateTagCodemodPlugin(
    [
      compatBuild(emberApp, undefined, {
        staticAddonTrees: true,
        staticAddonTestSupportTrees: true,
        staticInvokables: true,
        staticEmberSource: true,
        amdCompatibility: {
          es: [],
        },
      }),
    ],
    { shouldTransformPath, nameHint, dryRun }
  );
}

const TEMPLATE_ONLY_MARKER = `import templateOnlyComponent from '@ember/component/template-only';`;
const TEMPLATE_COLOCATION_MARKER = /\/\* import __COLOCATED_TEMPLATE__ from (.*) \*\//;

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
    const resolver = new ResolverLoader(process.cwd()).resolver;
    const hbs_file_test = /[\\/]rewritten-app[\\/]components[\\/].*\.hbs$/;
    // locate ember-source for the host app so we know which version to insert builtIns for
    const emberSourceEntrypoint = require.resolve('ember-source', { paths: [process.cwd()] });
    const emberVersion = JSON.parse(readFileSync(join(emberSourceEntrypoint, '../../package.json')).toString()).version;

    const ember_template_compiler = resolver.nodeResolve(
      'ember-source/vendor/ember/ember-template-compiler',
      resolve(locateEmbroiderWorkingDir(process.cwd()), 'rewritten-app', 'package.json')
    );
    if (ember_template_compiler.type === 'not_found') {
      throw 'This will not ever be true';
    }

    const embroider_compat_path = require.resolve('@embroider/compat', { paths: [process.cwd()] });
    const babel_plugin_ember_template_compilation = require.resolve('babel-plugin-ember-template-compilation', {
      paths: [embroider_compat_path],
    });
    const babel_plugin_syntax_decorators = require.resolve('@babel/plugin-syntax-decorators', {
      paths: [embroider_compat_path],
    });
    const babel_plugin_syntax_typescript = require.resolve('@babel/plugin-syntax-typescript', {
      paths: [embroider_compat_path],
    });
    const resolver_transform = ResolverTransform({
      appRoot: process.cwd(),
      emberVersion: emberVersion,
      externalNameHint: this.options.nameHint,
    });

    for await (const current_file of walkSync(tmp_path)) {
      if (hbs_file_test.test(current_file) && this.options.shouldTransformPath(current_file)) {
        const template_file_src = readFileSync(current_file).toLocaleString();

        // run the template transformations using embroider resolver information
        // to replace template values with js import syntax used in g(j/t)s
        let transformed_source =
          transformSync(hbsToJS(template_file_src), {
            plugins: [
              [
                babel_plugin_ember_template_compilation,
                {
                  compilerPath: ember_template_compiler.filename,
                  transforms: [resolver_transform],
                  targetFormat: 'hbs',
                },
              ],
            ],
            filename: current_file,
          })?.code ?? '';

        // using transformSync to parse and traverse in one go
        // we're only extracting the transformed template information from previous step
        // and preserving it for later assembly in the backing class
        const import_bucket: NodePath<t.ImportDeclaration>[] = [];
        let template_tag_value = '';
        transformSync(transformed_source, {
          plugins: [
            function template_tag_extractor(): unknown {
              return {
                visitor: {
                  ImportDeclaration(import_declaration: NodePath<t.ImportDeclaration>) {
                    const extractor = import_declaration.node.source.value.match(compatPattern);
                    if (extractor) {
                      const result = resolver.nodeResolve(extractor[0], current_file);
                      if (result.type === 'real') {
                        // find package there the resolver is pointing
                        const owner_package = resolver.packageCache.ownerOfFile(result.filename);
                        let relative_import_path = relative(owner_package!.root, result.filename);
                        // for addons strip off appPublicationDir from relative path
                        // we do this on app files as well as they don't contain the
                        // path that we strip off
                        // this makes sure that ambiguous imports get properly attributed
                        relative_import_path = relative_import_path.replace('_app_/', '');
                        // remove the extension to match what a developer would normally write
                        relative_import_path = relative_import_path.slice(0, -extname(relative_import_path).length);

                        // change import path to real one
                        import_declaration.node.source.value = owner_package!.name + '/' + relative_import_path;
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
                      template_tag_value = `<template>\n\t${path.node.arguments[0].value}\n</template>`;
                    }
                  },
                },
              };
            },
          ],
        });

        //find backing class
        const backing_class_resolution = resolver.nodeResolve(
          '#embroider_compat/' + relative(tmp_path, current_file).replace(/[\\]/g, '/').slice(0, -4),
          tmp_path
        );

        const backing_class_filename = 'filename' in backing_class_resolution ? backing_class_resolution.filename : '';
        // this can be either a generated js file in case of template only components
        // the js or ts file depending on what the app is configured
        const backing_class_src = readFileSync(backing_class_filename).toString();

        const is_typescript = extname(backing_class_filename) === '.ts';

        let insert_imports_byte_count = null;
        let insert_template_byte_count = null;

        const is_template_only = backing_class_src.indexOf(TEMPLATE_ONLY_MARKER) !== -1;

        // we parse the backing class to find the insert points for imports and template
        transformSync(backing_class_src, {
          plugins: [
            [
              is_typescript ? babel_plugin_syntax_typescript : babel_plugin_syntax_decorators,
              { decoratorsBeforeExport: true },
            ],
            function glimmer_syntax_creator(/* babel */): unknown {
              return {
                name: 'test',
                visitor: {
                  ImportDeclaration(import_declaration: NodePath<t.ImportDeclaration>) {
                    insert_imports_byte_count = import_declaration.node.end;
                  },
                  ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
                    // convention is that we have a default export for each component
                    // we look for the closing bracket of the class body
                    path.traverse({
                      ClassBody(path) {
                        // we substract 1 to find the byte right before the final closing bracket `}`
                        // this is the default insert point for template tag though it could live anywhere inside the class body
                        // possible future point to add option for putting template first thing in class
                        insert_template_byte_count = path.node.end ? path.node.end - 1 : 0;
                      },
                    });
                  },
                },
              };
            },
          ],
        });

        // list of imports needed by the previous hbs template extracted in second step
        const hbs_template_required_imports = import_bucket.join('\n');

        // we extracted all we needed from transformed_source so we switch to the second phase
        // transforming the backing class into what will be our final output
        transformed_source = backing_class_src;
        if (is_template_only) {
          // because we can't inject a comment as the default export
          // we replace the known exported string
          transformed_source = transformed_source.replace('templateOnlyComponent()', template_tag_value);
          // we clean known markers from generated files
          transformed_source = transformed_source.replace(TEMPLATE_ONLY_MARKER, hbs_template_required_imports);
          transformed_source = transformed_source.replace(TEMPLATE_COLOCATION_MARKER, '');
        } else {
          // we modify the source from end to start in order to keep our byte counts valid through the transforms
          if (insert_template_byte_count) {
            // first we split the backing class at the byte count we found during backing class parsing
            // then concat the string back together adding the transformed template in the middle
            transformed_source =
              transformed_source.substring(0, insert_template_byte_count) +
              '\n' +
              template_tag_value +
              '\n' +
              transformed_source.substring(insert_template_byte_count, transformed_source.length);
          }
          if (insert_imports_byte_count) {
            // first we split the backing class at the byte count we found during backing class parsing
            // then concat the string back together adding the transformed template in the middle
            transformed_source =
              transformed_source.substring(0, insert_imports_byte_count) +
              '\n' +
              hbs_template_required_imports +
              '\n' +
              transformed_source.substring(insert_imports_byte_count, transformed_source.length);
          }
          transformed_source = transformed_source.replace(TEMPLATE_COLOCATION_MARKER, '');
        }

        const dryRun = this.options.dryRun ? '--dry-run' : '';
        // work out original file path in app tree
        const app_relative_path = join('app', relative(tmp_path, current_file));
        const new_file_path = app_relative_path.slice(0, -4) + (is_typescript ? '.gts' : '.gjs');

        // write glimmer file out
        if (this.options.dryRun) {
          console.log('Write new file', new_file_path, transformed_source);
        } else {
          writeFileSync(join(process.cwd(), new_file_path), transformed_source, { flag: 'wx+' });
        }

        // git rm old files (js/ts if exists + hbs)
        let rm_hbs = await execute(`git rm ${app_relative_path} ${dryRun}`, {
          pwd: process.cwd(),
        });
        console.log(rm_hbs.output);

        if (!is_template_only) {
          // remove backing class only if it's not a template only component
          // resolve relative path to rewritten-app
          const app_relative_path = join('app', relative(tmp_path, backing_class_filename));
          let rm_js = await execute(`git rm ${app_relative_path} ${dryRun}`, {
            pwd: process.cwd(),
          });

          console.log(rm_js.output);
        }
      }
    }
  }
}

async function execute(
  shellCommand: string,
  opts?: { env?: Record<string, string>; pwd?: string }
): Promise<{
  exitCode: number;
  stderr: string;
  stdout: string;
  output: string;
}> {
  let env: Record<string, string | undefined> | undefined;
  if (opts?.env) {
    env = { ...process.env, ...opts.env };
  }
  let child = spawn(shellCommand, {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: opts?.pwd,
    shell: true,
    env,
  });
  let stderrBuffer: string[] = [];
  let stdoutBuffer: string[] = [];
  let combinedBuffer: string[] = [];
  child.stderr.on('data', data => {
    stderrBuffer.push(data);
    combinedBuffer.push(data);
  });
  child.stdout.on('data', data => {
    stdoutBuffer.push(data);
    combinedBuffer.push(data);
  });
  return new Promise(resolve => {
    child.on('close', (exitCode: number) => {
      resolve({
        exitCode,
        get stdout() {
          return stdoutBuffer.join('');
        },
        get stderr() {
          return stderrBuffer.join('');
        },
        get output() {
          return combinedBuffer.join('');
        },
      });
    });
  });
}
