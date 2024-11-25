import { existsSync } from 'fs';
import { globSync } from 'glob';
import { ResolverLoader } from '@embroider/core';

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
    console.log(`route template: ${filename} `);
  }
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
