import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { explicitRelative, hbsToJS, Package, ResolverLoader } from '@embroider/core';
import { parseAsync, transformAsync, type types } from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import extractMeta, { type ExtractMetaOpts, type MetaResult } from './extract-meta.js';
import { externalName } from '@embroider/reverse-exports';
import { dirname } from 'path';
import type { ResolverTransformOptions } from '@embroider/compat';
import { routeTemplateTransform } from './route-template-transform.js';

const require = createRequire(import.meta.url);

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

  // list of globs of the route templates we should convert.
  routeTemplates?: string[];

  // list of globs of the components we should convert
  components?: string[];

  // when a .js or .ts file already exists, we necessarily convert to .gjs or
  // .gts respectively. But when only an .hbs file exists, we have a choice of
  // default.
  defaultOutput?: 'gjs' | 'gts';

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
      routeTemplates: ['app/templates/**/*.hbs'],
      components: ['app/components/**/*.{js,ts,hbs}'],
      defaultOutput: 'gjs',
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

export async function inspectContents(
  filename: string,
  isRouteTemplate: boolean,
  opts: OptionsWithDefaults
): Promise<{ templateSource: string; scope: MetaResult['scope'] }> {
  let src = readFileSync(filename, 'utf8');
  let strictSource = (await transformAsync(hbsToJS(src), {
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
            ...(isRouteTemplate ? [routeTemplateTransform()] : []),
          ],
        } satisfies EtcOptions,
      ],
    ],
  }))!.code!;

  const meta: ExtractMetaOpts = { result: undefined };
  await transformAsync(strictSource, {
    filename,
    plugins: [[extractMeta, meta]],
  });
  if (!meta.result) {
    throw new Error(`failed to extract metadata while processing ${filename}`);
  }
  let { templateSource, scope } = await resolveImports(filename, meta.result, opts);
  return { templateSource, scope };
}

export async function processRouteTemplate(filename: string, opts: OptionsWithDefaults): Promise<void> {
  let { templateSource, scope } = await inspectContents(filename, true, opts);

  let outSource: string[] = [];

  if (opts.nativeRouteTemplates) {
    if (opts.defaultOutput === 'gts') {
      outSource.unshift(`import type { TemplateOnlyComponent } from '@ember/component/template-only';`);
      outSource.push(
        `export default <template>${templateSource}</template> satisfies TemplateOnlyComponent<${opts.routeTemplateSignature}>`
      );
    } else {
      outSource.push(`<template>${templateSource}</template>`);
    }
  } else {
    scope.set('RouteTemplate', {
      local: 'RouteTemplate',
      imported: 'default',
      module: 'ember-route-template',
    });
    if (opts.defaultOutput === 'gts') {
      outSource.push(
        `export default RouteTemplate<${opts.routeTemplateSignature}>(<template>${templateSource}</template>)`
      );
    } else {
      outSource.push(`export default RouteTemplate(<template>${templateSource}</template>)`);
    }
  }

  outSource.unshift(renderScopeImports(scope));

  writeFileSync(filename.replace(/.hbs$/, '.' + opts.defaultOutput), outSource.join('\n'));
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
): Promise<number> {
  let result = await parseAsync(jsSource, {
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
            return loc.start.index + 1;
          } else {
            return loc.end.index - 1;
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

export async function processComponent(
  hbsPath: string,
  jsPath: string | undefined,
  opts: OptionsWithDefaults
): Promise<void> {
  let { templateSource, scope } = await inspectContents(hbsPath, false, opts);

  if (jsPath) {
    let src = await renderJsComponent(templateSource, scope, jsPath, opts);
    let outExt = jsPath.endsWith('.ts') ? '.gts' : '.gjs';
    writeFileSync(hbsPath.replace(/.hbs$/, outExt), src);
    unlinkSync(hbsPath);
    unlinkSync(jsPath);
  } else {
    writeFileSync(
      hbsPath.replace(/.hbs$/, '.' + opts.defaultOutput),
      renderHbsOnlyComponent(templateSource, scope, opts)
    );
    unlinkSync(hbsPath);
  }
  console.log(`component: ${hbsPath}`);
}

async function renderJsComponent(
  templateSource: string,
  scope: MetaResult['scope'],
  jsPath: string,
  opts: OptionsWithDefaults
): Promise<string> {
  let jsSource = readFileSync(jsPath, 'utf8');
  let offset = await locateTemplateInsertionPoint(jsSource, jsPath, opts);
  let outSource: string[] = [];
  outSource.push(jsSource.slice(0, offset));
  outSource.push(`<template>${templateSource}</template>`);
  outSource.push(jsSource.slice(offset));
  outSource.unshift(renderScopeImports(scope));
  return outSource.join('\n');
}

function renderHbsOnlyComponent(templateSource: string, scope: MetaResult['scope'], opts: OptionsWithDefaults): string {
  let outSource: string[] = [];
  if (opts.defaultOutput === 'gts') {
    outSource.unshift(`import type { TemplateOnlyComponent } from '@ember/component/template-only';`);
    outSource.push(
      `export default <template>${templateSource}</template> satisfies TemplateOnlyComponent<${opts.templateOnlyComponentSignature}>`
    );
  } else {
    outSource.push(`<template>${templateSource}</template>`);
  }
  outSource.unshift(renderScopeImports(scope));
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
      let result = await parseAsync(content, { filename: targetFile });
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

async function resolveImports(filename: string, result: MetaResult, opts: OptionsWithDefaults): Promise<MetaResult> {
  let resolvedScope: MetaResult['scope'] = new Map();

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

function renderScopeImports(scope: MetaResult['scope']) {
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

      let named = entries.filter(e => e[1] !== 'default');
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

export async function run(partialOpts: Options) {
  let opts = optionsWithDefaults(partialOpts);
  await ensureAppSetup();
  await ensurePrebuild();
  await processRouteTemplates(opts);
  await processComponents(opts);
}
