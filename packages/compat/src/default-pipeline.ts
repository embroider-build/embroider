import type Options from './options';
import { recommendedOptions } from './options';
import { App, Addons as CompatAddons } from '.';
import type { Variant, EmberAppInstance } from '@embroider/core';
import type { Node } from 'broccoli-node-api';
import writeFile from 'broccoli-file-creator';
import mergeTrees from 'broccoli-merge-trees';
import type Plugin from 'broccoli-plugin';

export interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  variants?: Variant[];
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

export function compatBuild(emberApp: EmberAppInstance, Builder: typeof Plugin, options?: Options): Node {
  if (process.env.EMBROIDER_PREBUILD) {
    return prebuild(emberApp, options);
  }

  return new Builder([]);
}
