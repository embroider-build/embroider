import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import core, { type Package } from '@embroider/core';
import { traverse, parseAsync, type types, transformFromAstAsync } from '@babel/core';
import * as babel from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import { extractTemplates, locateTemplates, type ExtractedTemplate } from './extract-meta.js';
import reverseExports from '@embroider/reverse-exports';
import { dirname } from 'path';
import type { ResolverTransformOptions } from '@embroider/compat';
import { identifyRenderTests } from './identify-render-tests.js';
import { ImportUtil } from 'babel-import-util';
import { replaceThisTransform } from './replace-this-transform.js';

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
          enableLegacyModules: ['ember-cli-htmlbars'],
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

export async function processRouteTemplate(filename: string, opts: OptionsWithDefaults): Promise<void> {
  let hbsSource = readFileSync(filename, 'utf8');
  let jsSource = hbsToJS(hbsSource);
  let ast = await parseJS(filename, jsSource);
  let invokables = await locateInvokables(filename, ast, opts);
  ast = await runResolverTransform(ast, filename, invokables, '@controller');
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

export async function processComponent(
  hbsPath: string,
  jsPath: string | undefined,
  opts: OptionsWithDefaults
): Promise<void> {
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
    ast = await runResolverTransform(ast, jsPath, invokables, undefined);
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
    ast = await runResolverTransform(ast, hbsPath, invokables, undefined);
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
  return result!.ast!;
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

export async function processRenderTests(opts: OptionsWithDefaults): Promise<void> {
  for (let pattern of opts.renderTests) {
    for (let filename of globSync(pattern)) {
      await processRenderTest(filename, opts);
    }
  }
}

const selfToken = '___self9370___';

export async function processRenderTest(filename: string, opts: OptionsWithDefaults): Promise<void> {
  let src = readFileSync(filename, 'utf8');
  let ast = await parseJS(filename, src);
  let renderTests = await identifyRenderTests(ast, src, filename);
  if (renderTests.length === 0) {
    return;
  }

  let edits = deleteImports(ast);

  let invokables = await locateInvokables(filename, ast, opts);
  ast = await runResolverTransform(ast, filename, invokables, opts.nativeLexicalThis ? undefined : selfToken);
  let finalTemplates = await extractTemplates(ast, filename);
  if (finalTemplates.length !== renderTests.length) {
    throw new Error(
      `bug: unexpected mismatch in number of templates ${renderTests.length} != ${finalTemplates.length}`
    );
  }

  edits.unshift({
    start: 0,
    end: 0,
    replacement: extractImports(ast, path => !['@ember/template-compilation', 'ember-cli-htmlbars'].includes(path)),
  });
  for (let [index, test] of renderTests.entries()) {
    let templateSource = finalTemplates[index].templateSource;
    if (!opts.nativeLexicalThis) {
      if (templateSource.includes(selfToken)) {
        edits.push({
          start: test.statementStart,
          end: test.statementStart,
          replacement: `const ${test.availableBinding} = this;\n`,
        });
        templateSource = templateSource.replaceAll(selfToken, test.availableBinding);
      }
    }
    edits.push({
      start: test.startIndex,
      end: test.endIndex,
      replacement: '<template>' + templateSource + '</template>',
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
  invokables: Map<string, string>,
  replaceThisWith: string | undefined
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
          enableLegacyModules: ['ember-cli-htmlbars'],
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
            ...(replaceThisWith ? [replaceThisTransform(replaceThisWith)] : []),
          ],
        } satisfies EtcOptions,
      ],
    ],
  });
  return result!.ast!;
}

function extractImports(ast: types.File, filter?: (path: string) => boolean): string {
  return ast.program.body
    .filter(b => b.type === 'ImportDeclaration' && (!filter || filter(b.source.value)))
    .map(d => generate(d).code)
    .join('\n');
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
