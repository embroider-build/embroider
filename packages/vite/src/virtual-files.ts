import { relative } from 'path';
import { Package } from '@embroider/core';
import { EngineConfig } from '@embroider/core/src/module-resolver';

type Options = {
  root: string;
  engine: EngineConfig;
  pkg: Package;
  environment: string;
  entryFolders?: string[];
};


type OptionsTest = {
  pkg: Package;
  entryFolders?: string[];
}

export function generateEntries({ root, engine, pkg, environment, entryFolders }: Options) {
  const folders = [
    'init',
    'initializers',
    'instance-initializers',
    'transforms',
    'services',
    'routes',
    'adapters',
    'models',
    'serializers',
    'templates',
  ].concat(entryFolders || []);
  const globPattern = `'../{${folders.join(',')}}/**/*.{js,ts,gjs,gts,hbs}'`;
  const deepMerge = `
              function merge(source, target) {
                for (const [key, val] of Object.entries(source)) {
                  if (val !== null && typeof val === \`object\`) {
                    target[key] ??=new val.__proto__.constructor();
                    merge(val, target[key]);
                  } else {
                    target[key] = val;
                  }
                }
                return target; // we're replacing in-situ, so this is more for chaining than anything else
              }
              `;
  let code = `
              ${deepMerge}
              import './-embroider-implicit-modules.js';
              import * as GlimmerManager from '${pkg.name}/component-managers/glimmer';
              import * as App from '${pkg.name}/app';
              import * as DataAdapter from '${pkg.name}/data-adapter';
              import * as AppRouter from '${pkg.name}/router';
              import AppEnv from '${pkg.name}/config/environment';
              import buildAppEnv from '../../config/environment';
              define('${pkg.name}/component-managers/glimmer', () => GlimmerManager);
              define('${pkg.name}/data-adapter', () => DataAdapter);

              define('${pkg.name}/router', () => AppRouter);

              merge(buildAppEnv('${environment}'), AppEnv);
              define('${pkg.name}/config/environment', () => AppEnv);
              `;
  const addonPatterns: string[] = [];
  engine.activeAddons.forEach((addon) => {
    addonPatterns.push(
      `'${relative(root + '/assets', addon.root)}/**/_app_/{${folders.join(',')}}/**/*.{js,ts,gjs,gts,hbs}'`
    )
  });
  code += `
              const appModules = import.meta.glob([${globPattern}], { eager: true });
              Object.entries(appModules).forEach(
                ([name, imp]) => define(
                  name.replace('../',
                  '${pkg.name}/').split('.')[0], () => imp
                )
              );

              const addonModules = import.meta.glob([${addonPatterns.join(',')}], { eager: true, exhaustive: true });
              Object.entries(addonModules).forEach(
                ([name, imp]) => define(
                  '${pkg.name}' + name.split('_app_')[1].split('.')[0], () => imp
                )
              );
              define('${pkg.name}/app', () => App);
              if (!runningTests) {
                require('${pkg.name}/app').default.create({"name":"${pkg.name}","version":"${pkg.version}+cf3ef785"});
              }
              `;
  return code;
}


export function generateTestEntries({ pkg, entryFolders }: OptionsTest) {
  const folders = [
    'helpers',
    'integration',
    'unit',
  ].concat(entryFolders || []);
  const globPattern = `'../../tests/{${folders.join(',')}}/**/*.{js,ts,gjs,gts,hbs}'`;

  let code = `
              import './vite-app.js';
              import './-embroider-implicit-test-modules.js';
              import * as helperIndex from '../../tests/helpers/index';
              import * as testHelper from '../../tests/test-helper';
              define('${pkg.name}/tests/helpers/index', () => helperIndex);
              define('${pkg.name}/tests/test-helper', () => testHelper);
              `;
  code += `
              const appModules = import.meta.glob([${globPattern}], { eager: true });
              Object.entries(appModules).forEach(
                ([name, imp]) => define(
                  name.replace('../../',
                  '${pkg.name}/').split('.')[0], () => imp
                )
              );
              require('${pkg.name}/tests/test-helper');
              EmberENV.TESTS_FILE_LOADED = true;
              `;
  return code;
}
