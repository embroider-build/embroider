import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import core, { type Package } from '@embroider/core';
import { traverse, parseAsync, transformAsync, type types, transformFromAstAsync } from '@babel/core';
import * as babel from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import { extractTemplates, locateTemplates, type ExtractedTemplate } from './extract-meta.js';
import reverseExports from '@embroider/reverse-exports';
import { dirname } from 'path';
import type { ResolverTransformOptions } from '@embroider/compat';
import { replaceThisTransform } from './replace-this-transform.js';
import { identifyRenderTests, type RenderTest } from './identify-render-tests.js';
import { ImportUtil } from 'babel-import-util';

const { explicitRelative, hbsToJS, ResolverLoader } = core;
const { externalName } = reverseExports;
const require = createRequire(import.meta.url);
const { default: generate } = require('@babel/generator');

export interface Options {
  // when true, imports for other files in the same project will use relative
  // paths with file extensions. This is the most compatible with modern Node
  // ESM convensions, but it's not supported by Ember's classic build.
  relativeLocalPaths?: boolean;

  // file extensions to search when resolving dependencies inside templates
  extensions?: string[];

  // when true, assume we can use https://github.com/emberjs/rfcs/pull/1046.
  // Otherwise, assume we're using the ember-route-template addon.
  nativeRouteTemplates?: boolean;

  // when true, assume we can use
  // https://github.com/emberjs/babel-plugin-ember-template-compilation/pull/67.
  // This is mostly useful when codemodding rendering tests, which often access
  // `{{this.stuff}}` in a template. When false, polyfill that behavior by
  // introducing a new local variable.
  nativeLexicalThis?: boolean;

  // list of globs of the route templates we should convert.
  routeTemplates?: string[];

  // list of globs of the components we should convert
  components?: string[];

  // list of globs for JS/TS files that we will check for rendering tests to
  // update to template-tag
  renderTests?: string[];

  // when a .js or .ts file already exists, we necessarily convert to .gjs or
  // .gts respectively. But when only an .hbs file exists, we have a choice of
  // default.
  defaultFormat?: 'gjs' | 'gts';

  // snippet of typescript to use for the type signature of route templates.
  // Defaults to `{ Args: { model: unknown, controller: unknown } }`
  routeTemplateSignature?: string;

  // snippet of typescript to use for the type signature of newly-converted
  // template-only components. Defaults to `{ Args: {} }`
  templateOnlyComponentSignature?: string;

  templateInsertion?: 'beginning' | 'end';
}

export function optionsWithDefaults(options?: Options): OptionsWithDefaults {
  return Object.assign(
    {
      relativeLocalPaths: true,
      extensions: ['.gts', '.gjs', '.ts', '.js', '.hbs'],
      nativeRouteTemplates: true,
      nativeLexicalThis: true,
      routeTemplates: ['app/templates/**/*.hbs'],
      components: ['app/components/**/*.{js,ts,hbs}'],
      renderTests: ['tests/**/*.{js,ts}'],
      defaultFormat: 'gjs',
      routeTemplateSignature: `{ Args: { model: unknown, controller: unknown } }`,
      templateOnlyComponentSignature: `{ Args: {} }`,
      templateInsertion: 'beginning',
    },
    options
  );
}

type OptionsWithDefaults = Required<Options>;

export async function ensurePrebuild() {
  if (!existsSync('node_modules/.embroider')) {
    console.log(`Running addon prebuild...`);
    let { prebuild } = await import('./prebuild.js');
    await prebuild();
    console.log(`Completed addon prebuild.`);
  } else {
    console.log(`Reusing addon prebuild in node_modules/.embroider`);
  }
}

export async function ensureAppSetup() {
  let pkg: Package;
  try {
    pkg = resolverLoader.resolver.packageCache.get(process.cwd());
  } catch (err) {
    console.error(`Run template-tag-codemod inside a Ember app.`);
    process.exit(-1);
  }
  if (!pkg.packageJSON.exports) {
    throw new Error(`must use package.json exports for self-resolvability. Plase add this to package.json:

 "exports": {
    "./tests/*": "./tests/*",
    "./*": "./app/*"
  },

`);
  }
}

export async function processRouteTemplates(opts: OptionsWithDefaults) {
  for (let pattern of opts.routeTemplates) {
    for (let filename of globSync(pattern)) {
      await processRouteTemplate(filename, opts);
    }
  }
}

const resolverLoader = new ResolverLoader(process.cwd());
const resolutions = new Map<string, { type: 'real' } | { type: 'virtual'; content: string }>();

export interface InspectedTemplate {
  templateSource: string;
  scope: ExtractedTemplate['scope'];
  replacedThisWith: string | false;
}

async function locateInvokables(
  filename: string,
  ast: types.File,
  opts: OptionsWithDefaults
): Promise<Map<string, string>> {
  let resolverOutput = await transformFromAstAsync(ast, undefined, {
    ast: true,
    code: false,
    configFile: false,
    filename,
    plugins: [
      [
        templateCompilation,
        {
          targetFormat: 'hbs',
          transforms: [
            [
              require.resolve('@embroider/compat/src/resolver-transform'),
              {
                appRoot: process.cwd(),
                emberVersion: resolverLoader.resolver.options.emberVersion,
              } satisfies ResolverTransformOptions,
            ],
          ],
        } satisfies EtcOptions,
      ],
    ],
  });

  let requests = new Set<string>();

  traverse(resolverOutput!.ast!, {
    ImportDeclaration(path) {
      let specifier = path.node.source.value;
      if (specifier.startsWith('@embroider/virtual/')) {
        requests.add(specifier);
      }
    },
  });

  let resolutions = new Map();
  for (let request of requests) {
    resolutions.set(request, await resolveVirtualImport(filename, request, opts));
  }

  return resolutions;
}

async function resolveVirtualImport(filename: string, request: string, opts: OptionsWithDefaults): Promise<string> {
  let resolution = await resolverLoader.resolver.nodeResolve(request, filename, {
    extensions: opts.extensions,
  });
  if (resolution.type === 'not_found') {
    throw new Error(`Unable to resolve ${request} from ${filename}`);
  } else {
    resolutions.set(request, resolution);
    return await chooseImport(filename, resolution.filename, request, 'default', opts);
  }
}

export async function inspectContents(
  filename: string,
  src: string,
  replaceThisWith: string | false,
  opts: OptionsWithDefaults
): Promise<InspectedTemplate> {
  let replaced = { didReplace: false };
  let strictSource = (await transformAsync(hbsToJS(src), {
    configFile: false,
    filename,
    plugins: [
      [
        templateCompilation,
        {
          targetFormat: 'hbs',
          transforms: [
            [
              require.resolve('@embroider/compat/src/resolver-transform'),
              {
                appRoot: process.cwd(),
                emberVersion: resolverLoader.resolver.options.emberVersion,
                externalNameHint(name: string) {
                  return name;
                },
              } satisfies ResolverTransformOptions,
            ],
            ...(replaceThisWith ? [replaceThisTransform(replaceThisWith, replaced)] : []),
          ],
        } satisfies EtcOptions,
      ],
    ],
  }))!.code!;

  const meta = await extractMeta(strictSource, filename);
  let { templateSource, scope } = await resolveImports(filename, meta, opts);
  return { templateSource, scope, replacedThisWith: replaced.didReplace ? replaceThisWith : false };
}

export async function processRouteTemplate(filename: string, opts: OptionsWithDefaults): Promise<void> {
  let hbsSource = readFileSync(filename, 'utf8');
  let jsSource = hbsToJS(hbsSource);
  let ast = await parseJS(filename, jsSource);
  let invokables = await locateInvokables(filename, ast, opts);
  ast = await runResolverTransform(ast, filename, invokables);
  let finalTemplates = await extractTemplates(ast, filename);
  if (finalTemplates.length !== 1) {
    throw new Error(`bug: should see one templates, not ${finalTemplates.length}`);
  }
  let templateSource = finalTemplates[0].templateSource;
  let outSource: string[] = [extractImports(ast, path => path !== '@ember/template-compilation')];

  if (opts.nativeRouteTemplates) {
    if (opts.defaultFormat === 'gts') {
      outSource.unshift(`import type { TemplateOnlyComponent } from '@ember/component/template-only';`);
      outSource.push(
        `export default <template>${templateSource}</template> satisfies TemplateOnlyComponent<${opts.routeTemplateSignature}>`
      );
    } else {
      outSource.push(`<template>${templateSource}</template>`);
    }
  } else {
    outSource.unshift(`import RouteTemplate from 'ember-route-template`);
    if (opts.defaultFormat === 'gts') {
      outSource.push(
        `export default RouteTemplate<${opts.routeTemplateSignature}>(<template>${templateSource}</template>)`
      );
    } else {
      outSource.push(`export default RouteTemplate(<template>${templateSource}</template>)`);
    }
  }

  writeFileSync(filename.replace(/.hbs$/, '.' + opts.defaultFormat), outSource.join('\n'));
  unlinkSync(filename);
  console.log(`route template: ${filename} `);
}

export async function processComponents(opts: OptionsWithDefaults): Promise<void> {
  let components = new Set<string>();
  for (let pattern of opts.components) {
    for (let filename of globSync(pattern)) {
      components.add(withoutExtension(filename, opts.extensions));
    }
  }
  for (let component of components) {
    let presentExtensions = opts.extensions.filter(ext => existsSync(component + ext));
    if (!presentExtensions.includes('.hbs')) {
      continue;
    }
    let jsExtensions = presentExtensions.filter(ext => ext !== '.hbs');
    if (jsExtensions.length > 1) {
      throw new Error(
        `while processing ${component}, found several files when we expected one: ${jsExtensions.join(', ')}`
      );
    }
    let jsExtension = jsExtensions[0];
    if (['.gjs', '.gts'].includes(jsExtension)) {
      throw new Error(`found both hbs and gjs/gts for ${component}, having both is not well-defined.`);
    }
    await processComponent(component + '.hbs', jsExtension ? component + jsExtension : undefined, opts);
  }
}

async function locateTemplateInsertionPoint(
  jsSource: string,
  jsPath: string,
  opts: OptionsWithDefaults
): Promise<{ offset: number; parsed: types.File; node: types.Node }> {
  let result = await parseAsync(jsSource, {
    configFile: false,
    filename: jsPath,
    plugins: [
      [require.resolve('@babel/plugin-syntax-decorators'), { legacy: true }],
      require.resolve('@babel/plugin-syntax-typescript'),
    ],
  });
  if (!result) {
    throw new Error(`unexpected failure to parse ${jsPath} with content\n${jsSource}`);
  }
  for (let statement of result.program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      let dec = statement.declaration;
      switch (dec.type) {
        case 'ClassDeclaration':
        case 'ClassExpression':
          let loc = dec.body.loc;
          if (!loc) {
            throw new Error(`parser is missing source location info`);
          }
          if (opts.templateInsertion === 'beginning') {
            return { offset: loc.start.index + 1, parsed: result, node: dec.body };
          } else {
            return { offset: loc.end.index - 1, parsed: result, node: dec.body };
          }
        default:
          throw new Error(`unimplemented declaration: ${dec.type}`);
      }
    }
    if (statement.type === 'ExportNamedDeclaration') {
      throw new Error(`unimplemented`);
    }
  }
  throw new Error(`found no export default in ${jsPath}`);
}

async function processComponent(hbsPath: string, jsPath: string | undefined, opts: OptionsWithDefaults): Promise<void> {
  let hbsSource = readFileSync(hbsPath, 'utf8');

  if (jsPath) {
    let jsSource = readFileSync(jsPath, 'utf8');
    let ast = await parseJS(jsPath, jsSource);
    let edits = deleteImports(ast);
    let { componentBody, templates } = await locateTemplates(ast, jsPath);
    if (templates.length > 0) {
      throw new Error(`unimplemented: component JS that already has some other templates in it`);
    }
    if (!componentBody) {
      throw new Error(`could not locate where to insert template into ${jsPath}`);
    }
    ast = await insertComponentTemplate(ast, componentBody.loc, hbsSource);
    let invokables = await locateInvokables(jsPath, ast, opts);
    ast = await runResolverTransform(ast, jsPath, invokables);
    let finalTemplates = await extractTemplates(ast, jsPath);
    if (finalTemplates.length !== 1) {
      throw new Error(`bug: should see one templates, not ${finalTemplates.length}`);
    }
    let index = opts.templateInsertion === 'beginning' ? componentBody.loc.start + 1 : componentBody.loc.end - 1;
    edits.push({ start: index, end: index, replacement: `<template>${finalTemplates[0].templateSource}</template>` });
    edits.unshift({
      start: 0,
      end: 0,
      replacement: extractImports(ast, path => path !== '@ember/template-compilation'),
    });
    let newSrc = applyEdits(jsSource, edits);
    writeFileSync(jsPath.replace(/\.js$/, '.gjs').replace(/\.ts$/, '.gts'), newSrc);
    unlinkSync(jsPath);
    unlinkSync(hbsPath);
  } else {
    let jsSource = hbsToJS(hbsSource);
    let ast = await parseJS(hbsPath, jsSource);
    let invokables = await locateInvokables(hbsPath, ast, opts);
    ast = await runResolverTransform(ast, hbsPath, invokables);
    let finalTemplates = await extractTemplates(ast, hbsPath);
    if (finalTemplates.length !== 1) {
      throw new Error(`bug: should see one templates, not ${finalTemplates.length}`);
    }
    let newSrc =
      extractImports(ast, path => path !== '@ember/template-compilation') + '\n' + hbsOnlyComponent(hbsSource, opts);
    writeFileSync(hbsPath.replace(/.hbs$/, '.' + opts.defaultFormat), newSrc);
    unlinkSync(hbsPath);
  }
  console.log(`component: ${hbsPath} `);
}

async function parseJS(filename: string, src: string): Promise<types.File> {
  let output = await parseAsync(src, {
    code: false,
    ast: true,
    configFile: false,
    filename,
    plugins: [
      [require.resolve('@babel/plugin-syntax-decorators'), { legacy: true }],
      require.resolve('@babel/plugin-syntax-typescript'),
    ],
  });
  if (!output) {
    throw new Error(`bug: no parse output`);
  }
  return output;
}

// insert the template into the given class body, using `precompileTemplate`
// syntax. This is not how we produce our final output. Rather, we're setting
// things up so embroider's resolver transform can see the template within the
// correct scope.
async function insertComponentTemplate(
  ast: types.File,
  loc: { start: number },
  hbsSource: string
): Promise<types.File> {
  let importUtil: ImportUtil;
  let didInsert = false;

  function inserter({ types: t }: typeof babel): babel.PluginObj {
    return {
      visitor: {
        Program(path) {
          importUtil = new ImportUtil(babel, path);
        },
        ClassBody(path) {
          if (path.node.loc?.start.index === loc.start) {
            let block = t.staticBlock([
              t.expressionStatement(
                t.callExpression(importUtil.import(path, '@ember/template-compilation', 'precompileTemplate'), [
                  t.stringLiteral(hbsSource),
                ])
              ),
            ]);
            path.node.body.unshift(block);
            didInsert = true;
          }
        },
      },
    };
  }
  let result = await transformFromAstAsync(ast, undefined, {
    code: false,
    ast: true,
    configFile: false,
    plugins: [inserter],
  });
  if (!didInsert) {
    throw new Error(`bug: failed to insert component template`);
  }
  return result!.ast;
}

async function combineComponentJS(
  jsPath: string,
  ast: types.File,
  hbsSource: string,
  opts: OptionsWithDefaults
): Promise<{ offset: number; ast: types.File }> {
  let offset: number | undefined;
  let importUtil: ImportUtil;

  function inserter({ types: t }: typeof babel): babel.PluginObj {
    return {
      visitor: {
        Program(path) {
          importUtil = new ImportUtil(babel, path);
        },
        ExportDefaultDeclaration(path) {
          let dec = path.node.declaration;
          switch (dec.type) {
            case 'ClassDeclaration':
            case 'ClassExpression':
              let loc = dec.body.loc;
              if (!loc) {
                throw new Error(`parser is missing source location info`);
              }
              let block = t.staticBlock([
                t.expressionStatement(
                  t.callExpression(importUtil.import(path, '@ember/template-compilation', 'precompileTemplate'), [
                    t.stringLiteral(hbsSource),
                  ])
                ),
              ]);
              if (opts.templateInsertion === 'beginning') {
                offset = loc.start.index + 1;
                dec.body.body.unshift(block);
                return;
              } else {
                offset = loc.end.index - 1;
                dec.body.body.push(block);
                return;
              }
            default:
              throw new Error(`unimplemented declaration: ${dec.type}`);
          }
        },
      },
    };
  }

  let result = await transformFromAstAsync(ast, undefined, {
    code: false,
    ast: true,
    configFile: false,
    filename: jsPath,
    plugins: [
      [require.resolve('@babel/plugin-syntax-decorators'), { legacy: true }],
      require.resolve('@babel/plugin-syntax-typescript'),
      inserter,
    ],
  });
  if (!result) {
    throw new Error(`unexpected failure to parse ${jsPath} with content\n${jsSource}`);
  }

  if (offset == null) {
    throw new Error(`found no export default in ${jsPath}`);
  }
  return { offset, ast: result.ast! };
}

async function renderJsComponent(
  templateSource: string,
  scope: ExtractedTemplate['scope'],
  jsPath: string,
  opts: OptionsWithDefaults
): Promise<string> {
  let jsSource = readFileSync(jsPath, 'utf8');
  let { offset } = await locateTemplateInsertionPoint(jsSource, jsPath, opts);
  let outSource: string[] = [];
  outSource.push(jsSource.slice(0, offset));
  outSource.push(`<template>${templateSource}</template>`);
  outSource.push(jsSource.slice(offset));
  outSource.unshift(renderScopeImports(scope));
  return outSource.join('\n');
}

function hbsOnlyComponent(templateSource: string, opts: OptionsWithDefaults): string {
  let outSource: string[] = [];
  if (opts.defaultFormat === 'gts') {
    outSource.unshift(`import type { TemplateOnlyComponent } from '@ember/component/template-only';`);
    outSource.push(
      `export default <template>${templateSource}</template> satisfies TemplateOnlyComponent<${opts.templateOnlyComponentSignature}>`
    );
  } else {
    outSource.push(`<template>${templateSource}</template>`);
  }
  return outSource.join('\n');
}

function load(filename: string): string {
  let resolution = resolutions.get(filename);
  if (!resolution) {
    throw new Error(`${filename} was not resolved by us`);
  }
  if (resolution.type === 'real') {
    return readFileSync(filename, 'utf8');
  } else {
    return resolution.content;
  }
}

function isDefaultReexport(statement: types.Statement): statement is types.ExportNamedDeclaration {
  if (statement.type !== 'ExportNamedDeclaration') {
    return false;
  }
  for (let specifier of statement.specifiers) {
    if (specifier.type === 'ExportSpecifier') {
      if (
        specifier.local.type === 'Identifier' &&
        specifier.local.name === 'default' &&
        specifier.exported.type === 'Identifier' &&
        specifier.exported.name === 'default'
      ) {
        return true;
      }
    }
  }
  return false;
}

function withoutExtension(name: string, extensions: string[]): string {
  let matched = extensions.find(ext => name.endsWith(ext));
  if (matched) {
    return name.slice(0, -1 * matched.length);
  }
  return name;
}

async function chooseImport(
  fromFile: string,
  targetFile: string,
  importedModule: string,
  importedName: string,
  opts: OptionsWithDefaults
): Promise<string> {
  if (!importedModule.startsWith('@embroider/virtual')) {
    return importedModule;
  }
  let pkg = resolverLoader.resolver.packageCache.ownerOfFile(targetFile);
  if (!pkg) {
    throw new Error(`Unexpected unowned file ${targetFile}`);
  }

  let importingPkg = resolverLoader.resolver.packageCache.ownerOfFile(fromFile);
  if (!importingPkg) {
    throw new Error(`Unexpected unowned file ${fromFile}`);
  }
  if (importingPkg === pkg) {
    if (opts.relativeLocalPaths) {
      return explicitRelative(dirname(fromFile), targetFile);
    } else {
      let external = externalName(pkg.packageJSON, explicitRelative(pkg.root, targetFile));
      if (!external) {
        throw new Error(`Found no publicly accessible name for ${targetFile} in package ${pkg.name}`);
      }
      return withoutExtension(external, opts.extensions);
    }
  }

  // Look into javascript files that came from addons to attempt to skip over
  // the classical "app tree reexport" path.
  if (targetFile.endsWith('.js') && importedName === 'default') {
    let match = resolverLoader.resolver.reverseSearchAppTree(pkg, targetFile);
    if (match) {
      // this file is in an addon's app tree. Check whether it is just a
      // reexport.
      let content = load(targetFile);
      let result = await parseAsync(content, { filename: targetFile, configFile: false });
      if (!result) {
        throw new Error(`unexpected failure to parse ${targetFile} with content\n${content}`);
      }
      let statement = result.program.body.find(isDefaultReexport);
      if (statement && statement.source) {
        return statement.source.value;
      }
    }
  }

  let external = externalName(pkg.packageJSON, explicitRelative(pkg.root, targetFile));
  if (!external) {
    throw new Error(`Found no publicly accessible name for ${targetFile} in package ${pkg.name}`);
  }
  return external;
}

async function resolveImports(
  filename: string,
  result: ExtractedTemplate,
  opts: OptionsWithDefaults
): Promise<ExtractedTemplate> {
  let resolvedScope: ExtractedTemplate['scope'] = new Map();

  for (let [templateName, { local, imported, module }] of result.scope) {
    let resolution = await resolverLoader.resolver.nodeResolve(module, filename, {
      extensions: opts.extensions,
    });
    let resolvedModule: string;
    if (resolution.type === 'not_found') {
      throw new Error(`Unable to resolve ${module} from ${filename}`);
    } else {
      resolutions.set(resolution.filename, resolution);
      resolvedModule = await chooseImport(filename, resolution.filename, module, imported, opts);
    }
    resolvedScope.set(templateName, {
      local,
      imported,
      module: resolvedModule,
    });
  }

  return {
    templateSource: result.templateSource,
    scope: resolvedScope,
  };
}

function renderScopeImports(scope: ExtractedTemplate['scope']) {
  let modules = new Map<string, Map<string, string>>();
  for (let entry of scope.values()) {
    let module = modules.get(entry.module);
    if (!module) {
      module = new Map();
      modules.set(entry.module, module);
    }
    module.set(entry.local, entry.imported);
  }
  return [...modules]
    .sort()
    .map(([module, names]) => {
      let sections: string[] = [];
      let entries = [...names.entries()];

      let def = entries.find(e => e[1] === 'default');
      if (def) {
        sections.push(def[0]);
      }

      // it's possible to have more than one local name for the default export,
      // so this filter must only ignore the entry that we handled above, not
      // any others that happen to use `default` as their imported name.
      let named = entries.filter(e => e !== def);
      if (named.length > 0) {
        sections.push(
          '{' +
            named
              .map(([local, imported]) => {
                if (local === imported) {
                  return imported;
                } else {
                  return `${imported} as ${local}`;
                }
              })
              .join(',') +
            '}'
        );
      }

      return `import ${sections.join(',')} from "${module}";`;
    })
    .join('\n');
}

export async function processRenderTests(opts: OptionsWithDefaults): Promise<void> {
  for (let pattern of opts.renderTests) {
    for (let filename of globSync(pattern)) {
      await processRenderTest(filename, opts);
    }
  }
}

async function inspectTests(
  filename: string,
  renderTests: RenderTest[],
  opts: OptionsWithDefaults
): Promise<(InspectedTemplate & RenderTest)[]> {
  return await Promise.all(
    renderTests.map(async target => {
      let { templateSource, scope, replacedThisWith } = await inspectContents(
        filename,
        target.templateContent,
        opts.nativeLexicalThis ? false : target.availableBinding,
        opts
      );
      return { ...target, templateSource, scope, replacedThisWith };
    })
  );
}

export async function processRenderTest(filename: string, opts: OptionsWithDefaults): Promise<void> {
  let src = readFileSync(filename, 'utf8');
  let { parsed, renderTests } = await identifyRenderTests(src, filename);
  if (renderTests.length === 0) {
    return;
  }

  let edits = deleteImports(parsed);
  let inspectedTests = await inspectTests(filename, renderTests, opts);
  edits.unshift({ start: 0, end: 0, replacement: mergeImports(parsed, inspectedTests) });
  for (let test of inspectedTests) {
    if (!opts.nativeLexicalThis) {
      if (test.replacedThisWith) {
        edits.push({
          start: test.statementStart,
          end: test.statementStart,
          replacement: `const ${test.replacedThisWith} = this;\n`,
        });
      }
    }
    edits.push({
      start: test.startIndex,
      end: test.endIndex,
      replacement: '<template>' + test.templateSource + '</template>',
    });
  }
  let newSrc = applyEdits(src, edits);
  writeFileSync(filename.replace(/\.js$/, '.gjs').replace(/\.ts$/, '.gts'), newSrc);
  unlinkSync(filename);
  console.log(`render test: ${filename} `);
}

async function runResolverTransform(
  parsed: types.File,
  filename: string,
  invokables: Map<string, string>
): Promise<types.File> {
  let result = await babel.transformFromAstAsync(parsed, undefined, {
    ast: true,
    code: false,
    configFile: false,
    filename,
    plugins: [
      [
        templateCompilation,
        {
          targetFormat: 'hbs',
          transforms: [
            [
              require.resolve('@embroider/compat/src/resolver-transform'),
              {
                appRoot: process.cwd(),
                emberVersion: resolverLoader.resolver.options.emberVersion,
                externalNameHint: name => name,
                externalResolve: module => invokables.get(module) ?? module,
              } satisfies ResolverTransformOptions,
            ],
          ],
        } satisfies EtcOptions,
      ],
    ],
  });
  return result!.ast!;

  // let imports: string[] = [];

  // traverse(babelOutput!.ast!, {
  //   ImportDeclaration(path) {
  //     imports.push(generate(path.node).code);
  //   },
  // });
  // let templates = await extractTemplates(babelOutput!.ast!, filename);
  // return { imports: imports.join('\n'), templates };
}

function extractImports(ast: types.File, filter?: (path: string) => boolean): string {
  return ast.program.body
    .filter(b => b.type === 'ImportDeclaration' && (!filter || filter(b.source.value)))
    .map(d => generate(d).code)
    .join('\n');
}

function mergeImports(parsed: types.File, inspectedTests: (InspectedTemplate & { node: types.Node })[]) {
  let importUtil: ImportUtil;

  traverse(parsed, {
    Program(path) {
      importUtil = new ImportUtil(babel, path);
      importUtil.removeImport('ember-cli-htmlbars', 'hbs');
    },
    TaggedTemplateExpression(path) {
      let matched = inspectedTests.find(t => t.node === path.node);
      if (matched) {
        for (let [inTemplateName, { imported, module }] of matched.scope) {
          let name = importUtil.import(path, module, imported, inTemplateName);
          if (name.name !== inTemplateName) {
            throw new Error('unimplemented');
          }
        }
      }
    },
  });
  let imports = parsed.program.body
    .filter(b => b.type === 'ImportDeclaration')
    .map(d => generate(d).code)
    .join('\n');
  return imports;
}

function deleteImports(parsed: types.File): Edit[] {
  let edits: Edit[] = [];
  traverse(parsed, {
    ImportDeclaration(path) {
      let loc = path.node.loc;
      if (!loc) {
        throw new Error(`bug: babel not producing source locations`);
      }
      edits.push({
        start: loc.start.index,
        end: loc.end.index,
        replacement: null,
      });
    },
  });
  return edits;
}

interface Edit {
  start: number;
  end: number;
  replacement: string | null;
}

function applyEdits(source: string, edits: { start: number; end: number; replacement: string | null }[]): string {
  let cursor = 0;
  let output: string[] = [];
  let previousDeletion = false;
  for (let { start, end, replacement } of edits) {
    if (start > cursor) {
      let interEditContent = source.slice(cursor, start);
      if (previousDeletion && replacement === null && /^\s*$/.test(interEditContent)) {
        // drop whitespace in between two other deletions
      } else {
        output.push(interEditContent);
      }
    }
    if (replacement === null) {
      previousDeletion = true;
    } else {
      previousDeletion = false;
      output.push(replacement);
    }
    cursor = end;
  }
  output.push(source.slice(cursor));
  return output.join('');
}

export async function run(partialOpts: Options) {
  let opts = optionsWithDefaults(partialOpts);
  await ensureAppSetup();
  await ensurePrebuild();
  await processRouteTemplates(opts);
  await processComponents(opts);
  await processRenderTests(opts);
}
