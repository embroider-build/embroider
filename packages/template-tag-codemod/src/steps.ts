import { existsSync, readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { explicitRelative, hbsToJS, ResolverLoader } from '@embroider/core';
import { parseAsync, transformAsync, type types } from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import extractMeta, { type ExtractMetaOpts, type MetaResult } from './extract-meta.js';
import { externalName } from '@embroider/reverse-exports';
import { dirname } from 'path';
const require = createRequire(import.meta.url);

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
  let pkg = resolver.packageCache.get(process.cwd());
  if (!pkg.packageJSON.exports) {
    throw new Error(`must use package.json exports for self-resolvability. Plase add this to package.json:

 "exports": {
    "./tests/*": "./tests/*",
    "./*": "./app/*"
  },

`);
  }
}

export async function processRouteTemplates() {
  for (let filename of globSync('app/templates/*.hbs')) {
    await processRouteTemplate(filename);
  }
}

const resolver = new ResolverLoader(process.cwd()).resolver;
const resolutions = new Map<string, { type: 'real' } | { type: 'virtual'; content: string }>();

export async function processRouteTemplate(filename: string) {
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
                emberVersion: resolver.options.emberVersion,
                externalNameHint(name: string) {
                  return name;
                },
              },
            ],
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
  let result = await resolveImports(filename, meta.result);
  let outSource: string[] = [];
  outSource.push(renderScopeImports(result));
  outSource.push(`<template>${result.templateSource}</template>`);
  writeFileSync(filename.replace(/.hbs$/, '.gjs'), outSource.join('\n'));
  console.log(`route template: ${filename} `);
}

export async function processComponentTemplates() {
  for (let filename of globSync('app/components/*.hbs')) {
    console.log(`component template: ${filename} `);
  }
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

async function chooseImport(fromFile: string, targetFile: string, importedName: string): Promise<string> {
  let pkg = resolver.packageCache.ownerOfFile(targetFile);
  if (!pkg) {
    throw new Error(`Unexpected unowned file ${targetFile}`);
  }

  let importingPkg = resolver.packageCache.ownerOfFile(fromFile);
  if (!importingPkg) {
    throw new Error(`Unexpected unowned file ${fromFile}`);
  }
  if (importingPkg === pkg) {
    // local import
    return explicitRelative(dirname(fromFile), targetFile);
  }

  // Look into javascript files that came from addons to attempt to skip over
  // the classical "app tree reexport" path.
  if (targetFile.endsWith('.js') && importedName === 'default') {
    let match = resolver.reverseSearchAppTree(pkg, targetFile);
    if (match) {
      // this file is in an addon's app tree. Check whether it is just a
      // reexport.
      let content = load(targetFile);
      let result = await parseAsync(content);
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

async function resolveImports(filename: string, result: MetaResult): Promise<MetaResult> {
  let resolvedScope: MetaResult['scope'] = new Map();

  for (let [templateName, { local, imported, module }] of result.scope) {
    let resolution = await resolver.nodeResolve(module, filename, {
      extensions: ['.gts', '.gjs', '.ts', '.hbs.js', '.hbs'],
    });
    let resolvedModule: string;
    if (resolution.type === 'not_found') {
      throw new Error(`Unable to resolve ${module} from ${filename}`);
    } else {
      resolutions.set(resolution.filename, resolution);
      resolvedModule = await chooseImport(filename, resolution.filename, imported);
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

function renderScopeImports(result: MetaResult) {
  let modules = new Map<string, Map<string, string>>();
  for (let entry of result.scope.values()) {
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
