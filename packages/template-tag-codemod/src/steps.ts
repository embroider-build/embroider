import { existsSync, readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { hbsToJS, ResolverLoader } from '@embroider/core';
import { transformAsync } from '@babel/core';
import templateCompilation, { type Options as EtcOptions } from 'babel-plugin-ember-template-compilation';
import { createRequire } from 'module';
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
  let outSrc = (await transformAsync(hbsToJS(src), {
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
  writeFileSync(filename.replace(/.hbs$/, '.js'), outSrc);
  console.log(`route template: ${filename} `);
}

export async function processComponentTemplates() {
  for (let filename of globSync('app/components/*.hbs')) {
    console.log(`component template: ${filename} `);
  }
}

export async function todo() {
  let loader = new ResolverLoader(process.cwd());
  return loader.resolver;
}
