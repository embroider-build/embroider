import type Options from './options';
import { recommendedOptions } from './options';
import { App, Addons as CompatAddons } from '.';
import type { PackagerConstructor, Variant, EmberAppInstance } from '@embroider/core';
import { toBroccoliPlugin } from '@embroider/core';
import { tmpdir } from '@embroider/core';
import type { Node } from 'broccoli-node-api';
import writeFile from 'broccoli-file-creator';
import mergeTrees from 'broccoli-merge-trees';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { sync as pkgUpSync } from 'pkg-up';

export interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  variants?: Variant[];
}

export function stableWorkspaceDir(appRoot: string, environment: string) {
  let hash = createHash('md5');
  hash.update(dirname(pkgUpSync({ cwd: appRoot })!));
  hash.update(environment);
  return join(tmpdir, 'embroider', hash.digest('hex').slice(0, 6));
}

export default function defaultPipeline<PackagerOptions>(
  emberApp: EmberAppInstance,
  packager?: PackagerConstructor<PackagerOptions>,
  options: PipelineOptions<PackagerOptions> = {}
): Node {
  let outputPath: string;
  let addons;

  let embroiderApp = new App(emberApp, options);

  addons = new CompatAddons(embroiderApp);
  addons.ready().then(result => {
    outputPath = result.outputPath;
  });

  if (process.env.STAGE1_ONLY) {
    return mergeTrees([addons.tree, writeFile('.stage1-output', () => outputPath)]);
  }

  if (process.env.STAGE2_ONLY || !packager) {
    return mergeTrees([embroiderApp.asStage(addons).tree, writeFile('.stage2-output', () => outputPath)]);
  }

  let BroccoliPackager = toBroccoliPlugin(packager);
  let variants = (options && options.variants) || defaultVariants(emberApp);
  return new BroccoliPackager(embroiderApp.asStage(addons), variants, options && options.packagerOptions);
}

const defaultPrebuildOptions = {
  ...recommendedOptions.optimized,
  amdCompatibility: {
    es: [],
  },
};

export function prebuild(emberApp: EmberAppInstance, options?: Options): Node {
  let outputPath: string;
  let addons;

  let embroiderApp = new App(emberApp, { ...defaultPrebuildOptions, ...options });

  addons = new CompatAddons(embroiderApp);
  addons.ready().then(result => {
    outputPath = result.outputPath;
  });

  if (process.env.STAGE1_ONLY) {
    return mergeTrees([addons.tree, writeFile('.stage1-output', () => outputPath)]);
  }

  return mergeTrees([embroiderApp.asStage(addons).tree, writeFile('.stage2-output', () => outputPath)]);
}

function hasFastboot(emberApp: EmberAppInstance | EmberAppInstance) {
  return emberApp.project.addons.find(a => a.name === 'ember-cli-fastboot');
}

function defaultVariants(emberApp: EmberAppInstance): Variant[] {
  let variants: Variant[] = [];
  if (emberApp.env === 'production') {
    variants.push({
      name: 'browser',
      runtime: 'browser',
      optimizeForProduction: true,
    });
    if (hasFastboot(emberApp)) {
      variants.push({
        name: 'fastboot',
        runtime: 'fastboot',
        optimizeForProduction: true,
      });
    }
  } else {
    variants.push({
      name: 'dev',
      runtime: hasFastboot(emberApp) ? 'all' : 'browser',
      optimizeForProduction: false,
    });
  }
  return variants;
}
