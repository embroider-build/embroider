import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import core, { locateEmbroiderWorkingDir } from '@embroider/core';
import { traverse, parseAsync, type types, transformFromAstAsync } from '@babel/core';
import * as babel from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import { extractTemplates, locateTemplates } from './extract-meta.js';
import reverseExports from '@embroider/reverse-exports';
import { basename, dirname, relative, resolve } from 'path';
import type { ResolverTransformOptions } from '@embroider/compat';
import { identifyRenderTests } from './identify-render-tests.js';
import { ImportUtil } from 'babel-import-util';
import { replaceThisTransform } from './replace-this-transform.js';
// @ts-expect-error library ships types incompatible with moduleResolution:nodenext
import { ModuleImporter } from '@humanwhocodes/module-importer';
import { allHBSModules, allLegacyModules } from './detect-inline-hbs.js';
import chalk from 'chalk';

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

  // Path to an ES module whose default export implements a function like
  //
  //    (name: string, kind: 'component' | 'helper' | 'modifier' | 'ambiguous-component-or-helper') => string;
  //
  // Return a string to pick the desired name for a given invocation of the component,
  // helper, or modifier. Return null to fall back to default behavior.
  //
  // The default value is "@embroider/template-tag-codemod/defeault-renaming",
  // which is public API that you may choose to call directly (remember you may
  // need to install `@embroider/template-tag-codemod` as a dependency to access
  // it in this way)
  renamingRules?: string;

  /**
   * Path to an ES module whose default export implements a function like
   *
   *    (path: string, filename: string, resolve: (path: string, filename: string) => string) => string;
   *
   * Return a string to provide a resolvable import path, based on the original import `path` and optionally
   * the `filename` where the import appears. Return `undefined` to fall back to the default behavior or call
   * `resolve` to use that default implementation.
   */
  customResolver?: string;

  /**
   * This allows you to reuse the ember-prebuild if you are running the codemod multiple times.
   *
   * You should only set this setting if you know that any changes you're making will not influence
   * the prebuild in any way. Most people should leave this set to its default `false` value
   */
  reusePrebuild?: boolean;

  /**
   * Exports template-only components via a named const definition.
   *
   * This can improve import autocompletion in IDEs like VSCode.
   */
  addNameToTemplateOnly?: boolean;
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
      renamingRules: '@embroider/template-tag-codemod/default-renaming',
      reusePrebuild: false,
      addNameToTemplateOnly: false,
    },
    options
  );
}

type OptionsWithDefaults = Omit<Required<Options>, 'customResolver'> & Pick<Options, 'customResolver'>;

type Result =
  | { context: string; status: 'success' }
  | { context: string; status: 'failure'; messages: string[] }
  | { context: string; status: 'noop' };

export async function ensurePrebuild(opts: OptionsWithDefaults) {
  if (opts.reusePrebuild) {
    let working = locateEmbroiderWorkingDir(process.cwd());
    let versions: Record<string, string> = {};
    try {
      versions = JSON.parse(readFileSync(resolve(working, 'version.json'), 'utf8'));
    } catch (err) {}

    if (
      versions['@embroider/core'] &&
      versions['@embroider/core'] ===
        JSON.parse(readFileSync(require.resolve('@embroider/core/package.json'), 'utf8')).version
    ) {
      console.log(`Reusing addon prebuild in ${relative(process.cwd(), working)}`);
      return;
    }
  }

  console.log(`Running addon prebuild...`);
  let { prebuild } = await import('./prebuild.js');
  await prebuild();
  console.log(`Completed addon prebuild.`);
}

function colorGood(s: string): string {
  return chalk.blue(s);
}

function colorBad(s: string): string {
  return chalk.magenta(s);
}

export async function ensureAppSetup() {
  let filename = resolve(process.cwd(), 'package.json');
  let content: string;
  try {
    content = readFileSync(filename, 'utf8');
  } catch (err) {
    console.error(`Run template-tag-codemod inside a Ember app.`);
    process.exit(-1);
  }
  let json = JSON.parse(content);
  if (!json.exports) {
    json.exports = {
      './tests/*': './tests/*',
      './*': './app/*',
    };
    writeFileSync(filename, JSON.stringify(json, null, 2));
  }
}

export async function processRouteTemplates(opts: OptionsWithDefaults): Promise<Result[]> {
  let results: Result[] = [];
  for (let pattern of opts.routeTemplates) {
    for (let filename of globSync(pattern)) {
      let result = await ensureResult(`route template: ${filename} `, () => processRouteTemplate(filename, opts));
      briefLogResult(result);
      results.push(result);
    }
  }
  return results;
}

// this makes sure that we don't fight with other versions of embroider currently running on the system
// we will only pick our template-tag-codemod specific working directory if there hasn't been one set
// already. Also note that this is first read with the ResolverLoader below so this is the perfect place
// to apply this setting
if (!process.env.EMBROIDER_WORKING_DIRECTORY) {
  process.env['EMBROIDER_WORKING_DIRECTORY'] = 'node_modules/.template-tag-codemod';
}

const resolverLoader = new ResolverLoader(process.cwd());

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
          enableLegacyModules: allLegacyModules(),
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
  let resolve = async (path: string, filename: string) => {
    let resolution = await resolverLoader.resolver.nodeResolve(path, filename, {
      extensions: opts.extensions,
    });
    if (resolution.type !== 'not_found') {
      return await chooseImport(filename, resolution, path, 'default', opts);
    }
  };

  if (opts.customResolver) {
    let customResolver = (await new ModuleImporter().import(opts.customResolver)).default;
    let customResult = await customResolver(request, filename, resolve);

    if (customResult) {
      return customResult;
    }
  }

  let resolvedImport = await resolve(request, filename);

  if (!resolvedImport) {
    throw new Error(`Unable to resolve ${request} from ${filename}`);
  }

  return resolvedImport;
}

export async function processRouteTemplate(filename: string, opts: OptionsWithDefaults): Promise<Result> {
  let hbsSource = readFileSync(filename, 'utf8');
  let jsSource = hbsToJS(hbsSource);
  let ast = await parseJS(filename, jsSource);
  let invokables = await locateInvokables(filename, ast, opts);
  ast = await runResolverTransform(ast, filename, invokables, '@controller', opts);
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
    outSource.unshift(`import RouteTemplate from 'ember-route-template'`);
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
  return { context: `route template: ${filename} `, status: 'success' };
}

async function ensureResult(context: string, cb: () => Promise<Result>): Promise<Result> {
  try {
    return await cb();
  } catch (err) {
    return { context, status: 'failure', messages: [`Unhandled exception: ${err}`] };
  }
}

export async function processComponents(opts: OptionsWithDefaults): Promise<Result[]> {
  let results: Result[] = [];
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
    let result = await ensureResult(`component: ${component}.hbs`, () =>
      processComponent(component + '.hbs', jsExtension ? component + jsExtension : undefined, opts)
    );
    briefLogResult(result);
    results.push(result);
  }
  return results;
}

// Copied from https://github.com/emberjs/ember-string/blob/16fffa2a565f21c177f9cfa41751ba60b9634863/src/index.ts
const STRING_CLASSIFY_REGEXP_1 = /^(\-|_)+(.)?/;
const STRING_CLASSIFY_REGEXP_2 = /(.)(\-|\_|\.|\s)+(.)?/g;
const STRING_CLASSIFY_REGEXP_3 = /(^|\/|\.)([a-z])/g;

function classify(str: string) {
  const replace1 = (_match: string, _separator: string, chr: string) => (chr ? `_${chr.toUpperCase()}` : '');
  const replace2 = (_match: string, initialChar: string, _separator: string, chr: string) =>
    initialChar + (chr ? chr.toUpperCase() : '');
  const parts = str.split('/');

  for (let i = 0; i < parts.length; i++) {
    parts[i] = (parts as any)[i]
      .replace(STRING_CLASSIFY_REGEXP_1, replace1)
      .replace(STRING_CLASSIFY_REGEXP_2, replace2);
  }

  return parts.join('/').replace(STRING_CLASSIFY_REGEXP_3, (match /*, separator, chr */) => match.toUpperCase());
}

export async function processComponent(
  hbsPath: string,
  jsPath: string | undefined,
  opts: OptionsWithDefaults
): Promise<Result> {
  let hbsSource = readFileSync(hbsPath, 'utf8');

  if (jsPath) {
    let jsSource = readFileSync(jsPath, 'utf8');
    let ast = await parseJS(jsPath, jsSource);
    let edits = deleteImports(ast);
    let { component, templates } = await locateTemplates(ast, jsPath);
    if (templates.length > 0) {
      return {
        context: `component: ${hbsPath}`,
        status: 'failure',
        messages: [`unimplemented: component JS that already has some other templates in it`],
      };
    }
    if (!component) {
      return {
        context: `component: ${hbsPath}`,
        status: 'failure',
        messages: [`could not locate where to insert template into ${jsPath}`],
      };
    }
    if ('problem' in component) {
      return { context: `component: ${hbsPath}`, status: 'failure', messages: [component.problem] };
    }

    if ('bodyNode' in component) {
      ast = await insertTemplateIntoComponentClass(ast, component.loc, hbsSource);
    } else {
      ast = await replaceTemplateOnlyCallWithTemplate(ast, component.loc, hbsSource);
    }

    let invokables = await locateInvokables(jsPath, ast, opts);
    ast = await runResolverTransform(ast, jsPath, invokables, undefined, opts);
    let finalTemplates = await extractTemplates(ast, jsPath);
    if (finalTemplates.length !== 1) {
      throw new Error(`bug: should see one templates, not ${finalTemplates.length}`);
    }

    const templateReplacement = `<template>${finalTemplates[0].templateSource}</template>`;
    if ('bodyNode' in component) {
      // Inserting into a component class body
      let index = opts.templateInsertion === 'beginning' ? component.loc.start + 1 : component.loc.end - 1;
      edits.push({ start: index, end: index, replacement: templateReplacement });
    } else {
      // Replacing a templateOnlyComponent() call, so replace the call itself
      // with the template replacement
      let replacement = templateReplacement;

      let signatureType = component.tocNode.typeParameters?.params[0];
      if (signatureType) {
        // The templateOnlyComponent() call has a signature type argument, so we
        // must be in Typescript-land. So, add an import of
        // `TemplateOnlyComponent` and include a satisfies expression in the
        // template replacement
        edits.unshift({
          start: 0,
          end: 0,
          replacement: `import type { TemplateOnlyComponent } from '@ember/component/template-only';`,
        });
        replacement = [replacement, 'satisfies', `TemplateOnlyComponent<${generate(signatureType).code}>`].join(' ');
      }
      edits.push({ start: component.loc.start, end: component.loc.end, replacement });
    }

    edits.unshift({
      start: 0,
      end: 0,
      replacement: extractImports(
        ast,
        path => path !== '@ember/template-compilation' && path !== '@ember/component/template-only'
      ),
    });
    let newSrc = applyEdits(jsSource, edits);
    writeFileSync(jsPath.replace(/\.js$/, '.gjs').replace(/\.ts$/, '.gts'), newSrc);
    unlinkSync(jsPath);
    unlinkSync(hbsPath);
  } else {
    let jsSource = hbsToJS(hbsSource);
    let ast = await parseJS(hbsPath, jsSource);
    let invokables = await locateInvokables(hbsPath, ast, opts);
    ast = await runResolverTransform(ast, hbsPath, invokables, undefined, opts);
    let finalTemplates = await extractTemplates(ast, hbsPath);
    if (finalTemplates.length !== 1) {
      throw new Error(`bug: should see one templates, not ${finalTemplates.length}`);
    }
    let desiredComponentName = classify(basename(hbsPath, '.hbs'));
    let componentName = availableNameForTemplate(ast, desiredComponentName);
    let newSrc =
      extractImports(ast, path => path !== '@ember/template-compilation') +
      '\n' +
      hbsOnlyComponent(finalTemplates[0].templateSource, componentName, opts);
    writeFileSync(hbsPath.replace(/.hbs$/, '.' + opts.defaultFormat), newSrc);
    unlinkSync(hbsPath);
  }
  return { context: `component: ${hbsPath}`, status: 'success' };
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
async function insertTemplateIntoComponentClass(
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

// replace the `templateOnlyComponent()` expression with the template using
// `precompileTemplate` syntax. This is not how we produce our final output.
// Rather, we're setting things up so embroider's resolver transform can see the
// template within the correct scope.
async function replaceTemplateOnlyCallWithTemplate(
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
        CallExpression(path) {
          if (path.node.loc?.start.index === loc.start) {
            let block = t.callExpression(importUtil.import(path, '@ember/template-compilation', 'precompileTemplate'), [
              t.stringLiteral(hbsSource),
            ]);
            path.replaceWith(block);
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

function unusedNameLike(desiredName: string, isUsed: (name: string) => boolean): string {
  let candidate = desiredName;
  let counter = 0;
  while (isUsed(candidate)) {
    candidate = `${desiredName}${counter++}`;
  }
  return candidate;
}

function availableNameForTemplate(ast: types.File, name: string) {
  return unusedNameLike(name, candidate => {
    let exists = false;
    traverse(ast, {
      Program(path) {
        if (path.scope.hasBinding(candidate)) {
          exists = true;
        }
      },
    });
    return exists;
  });
}

function hbsOnlyComponent(templateSource: string, componentName: string, opts: OptionsWithDefaults): string {
  let outSource: string[] = [];
  if (opts.defaultFormat === 'gts') {
    outSource.unshift(`import type { TemplateOnlyComponent } from '@ember/component/template-only';`);

    let template = `<template>${templateSource}</template> satisfies TemplateOnlyComponent<${opts.templateOnlyComponentSignature}>`;
    if (opts.addNameToTemplateOnly) {
      outSource.push(`const ${componentName} = ${template};`);
      outSource.push(`export default ${componentName};`);
    } else {
      outSource.push(`export default ${template}`);
    }
  } else {
    let template = `<template>${templateSource}</template>`;
    if (opts.addNameToTemplateOnly) {
      outSource.push(`const ${componentName} = ${template};`);
      outSource.push(`export default ${componentName};`);
    } else {
      outSource.push(template);
    }
  }
  return outSource.join('\n');
}

function load(
  resolution: { type: 'real'; filename: string } | { type: 'virtual'; filename: string; content: string }
): string {
  if (resolution.type === 'real') {
    return readFileSync(resolution.filename, 'utf8');
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
  resolution: { type: 'real'; filename: string } | { type: 'virtual'; content: string; filename: string },
  importedModule: string,
  importedName: string,
  opts: OptionsWithDefaults
): Promise<string> {
  if (!importedModule.startsWith('@embroider/virtual')) {
    return importedModule;
  }
  let targetFile = resolution.filename;
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
    let match = resolverLoader.resolver.reverseSearchAppTree(targetFile);
    if (match) {
      // this file is in an addon's app tree. Check whether it is just a
      // reexport.
      let content = load(resolution);
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

function briefLogResult(result: Result) {
  if (result.status !== 'noop') {
    console.log(`${result.status === 'success' ? colorGood('success') : colorBad('failure')} ${result.context}`);
  }
}

export async function processRenderTests(opts: OptionsWithDefaults): Promise<Result[]> {
  let results: Result[] = [];
  for (let pattern of opts.renderTests) {
    for (let filename of globSync(pattern)) {
      let result = await ensureResult(`render test: ${filename}`, () => processRenderTest(filename, opts));
      results.push(result);
      briefLogResult(result);
    }
  }
  return results;
}

// most of this is just intentionally random, but the presence of '.' is
// semantically important. Without it, our token can look to embroider's
// resolver transform like a global helper invocation! Whereas paths with dots
// are never global invocations.
const selfToken = '___self93.70___';

export async function processRenderTest(filename: string, opts: OptionsWithDefaults): Promise<Result> {
  let src = readFileSync(filename, 'utf8');
  let ast = await parseJS(filename, src);
  let renderTests = await identifyRenderTests(ast, src, filename);
  if (renderTests.length === 0) {
    return { context: `render test: ${filename}`, status: 'noop' };
  }

  let edits = deleteImports(ast);

  let invokables = await locateInvokables(filename, ast, opts);
  ast = await runResolverTransform(ast, filename, invokables, opts.nativeLexicalThis ? undefined : selfToken, opts);
  let finalTemplates = await extractTemplates(ast, filename);
  if (finalTemplates.length !== renderTests.length) {
    throw new Error(
      `bug: unexpected mismatch in number of templates ${renderTests.length} != ${finalTemplates.length}`
    );
  }

  edits.unshift({
    start: 0,
    end: 0,
    replacement: extractImports(ast, path => !allHBSModules().includes(path)),
  });
  for (let [index, test] of renderTests.entries()) {
    let templateSource = finalTemplates[index].templateSource;
    if (!opts.nativeLexicalThis) {
      if (templateSource.includes(selfToken)) {
        let { identifier, needsInsertAt } = test.availableBinding();
        if (needsInsertAt != null) {
          edits.push({
            start: needsInsertAt,
            end: needsInsertAt,
            replacement: `const ${identifier} = this;\n`,
          });
        }
        templateSource = templateSource.replaceAll(selfToken, identifier);
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
  return { context: `render test: ${filename}`, status: 'success' };
}

const loadRenamingRules = (() => {
  return async function (renamingRules: string): Promise<NonNullable<ResolverTransformOptions['externalNameHint']>> {
    // First we resolve from the project
    try {
      // This uses process.cwd() by default, which is what we want.
      let mod = await new ModuleImporter().import(renamingRules);
      return mod.default;
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
    }

    // Then we resolve from ourself. This case covers importing
    // `@embroider/template-tag-codemod/default-renaming` when the project
    // doesn't have a dependency on the codemod.
    let mod = await import(renamingRules);
    return mod.default;
  };
})();

async function runResolverTransform(
  parsed: types.File,
  filename: string,
  invokables: Map<string, string>,
  replaceThisWith: string | undefined,
  opts: OptionsWithDefaults
): Promise<types.File> {
  // This uses process.cwd() by default, which is what we want.
  let externalNameHint = await loadRenamingRules(opts.renamingRules);
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
          enableLegacyModules: allLegacyModules(),
          transforms: [
            [
              require.resolve('@embroider/compat/src/resolver-transform'),
              {
                appRoot: process.cwd(),
                emberVersion: resolverLoader.resolver.options.emberVersion,
                externalNameHint,
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
      for (let comments of [path.node.leadingComments, path.node.trailingComments]) {
        if (comments) {
          for (let comment of comments) {
            if (comment.start != null && comment.end != null) {
              edits.push({
                start: comment.start,
                end: comment.end,
                replacement: null,
              });
            }
          }
        }
      }
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
  edits = [...edits].sort((a, b) => a.start - b.start);
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

function indent(s: string): string {
  return `    ` + s.replaceAll(/\n/g, `    \n`);
}

export async function run(partialOpts: Options) {
  let opts = optionsWithDefaults(partialOpts);
  let results: Result[] = [];
  await ensureAppSetup();
  await ensurePrebuild(opts);
  results = results.concat(await processRouteTemplates(opts));
  results = results.concat(await processComponents(opts));
  results = results.concat(await processRenderTests(opts));

  console.log(`\n${colorGood('Completed run, summarizing results:')}\n`);

  for (let result of results) {
    if (result.status === 'failure') {
      console.log(`${colorBad('Failed')} to handle ${result.context} because:`);
      for (let message of result.messages) {
        console.log(indent(message));
      }
    }
  }

  let successCount = results.filter(r => r.status === 'success').length;
  let failureCount = results.filter(r => r.status === 'failure').length;

  console.log(`${colorGood(String(successCount))} successful files, ${colorBad(String(failureCount))} failed files`);

  if (results.some(result => result.status === 'failure')) {
    process.exit(-1);
  }
}
