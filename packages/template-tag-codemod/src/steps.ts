import { existsSync, readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { explicitRelative, hbsToJS, ResolverLoader } from '@embroider/core';
import { transformAsync } from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
import extractMeta, { type ExtractMetaOpts, type MetaResult } from './extract-meta.js';
import { externalName } from '@embroider/reverse-exports';
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

export async function processRouteTemplates() {
  for (let filename of globSync('app/templates/*.hbs')) {
    await processRouteTemplate(filename);
  }
}

const resolver = new ResolverLoader(process.cwd()).resolver;

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

function chooseImport(_fromFile: string, targetFile: string): string {
  let pkg = resolver.packageCache.ownerOfFile(targetFile);
  if (!pkg) {
    throw new Error(`Unexpected unowned file ${targetFile}`);
  }
  let match = resolver.reverseSearchAppTree(pkg, targetFile);
  if (match) {
    throw new Error('implement me');
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
    let resolution = await resolver.nodeResolve(module, filename);
    let resolvedModule: string;
    if (resolution.type === 'real') {
      resolvedModule = chooseImport(filename, resolution.filename);
    } else if (resolution.type === 'not_found') {
      throw new Error(`Unable to resolve ${module} from ${filename}`);
    } else {
      throw new Error(`unimplemented ${resolution.type}`);
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
