import { App, Addons as CompatAddons, Options } from '.';
import { toBroccoliPlugin, PackagerConstructor, Variant, EmberAppInstance } from '@embroider/core';
import { Node } from 'broccoli-node-api';
import V1App from './v1-app';
import { join } from 'path';

export interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  onOutputPath?: (outputPath: string) => void;
  variants?: Variant[];
}

export default function defaultPipeline<PackagerOptions>(
  emberApp: EmberAppInstance,
  packager?: PackagerConstructor<PackagerOptions>,
  options: PipelineOptions<PackagerOptions> = {}
): Node {
  let addons = new CompatAddons(emberApp, options);

  if (process.env.STAGE1_ONLY) {
    return addons.tree;
  }

  let embroiderApp = new App(emberApp, addons.tree, options);

  if (process.env.STAGE2_ONLY || !packager) {
    return embroiderApp.tree;
  }

  let BroccoliPackager = toBroccoliPlugin(packager);
  let variants = (options && options.variants) || defaultVariants(emberApp);
  return new BroccoliPackager(
    embroiderApp.tree,
    join(V1App.root(emberApp), 'node_modules', '.embroider', 'app'),
    variants,
    options && options.packagerOptions
  );
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
