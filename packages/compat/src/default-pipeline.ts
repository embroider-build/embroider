import { App, compatAddons, Options } from '.';
import { toBroccoliPlugin, PackagerConstructor, Variant, EmberAppInstance, outputTree } from '@embroider/core';
import { Node } from 'broccoli-node-api';
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
  let embroiderApp = new App(emberApp, options);
  let stage1 = outputTree(
    compatAddons(embroiderApp),
    'embroider-stage-1',
    join('node_modules', '.embroider', 'rewritten-packages')
  );
  if (process.env.STAGE1_ONLY) {
    return stage1;
  }

  let stage2 = outputTree(
    embroiderApp.builder(stage1),
    'embroider-stage-2',
    join('node_modules', '.embroider', 'rewritten-app')
  );

  if (process.env.STAGE2_ONLY || !packager) {
    return stage2;
  }

  let BroccoliPackager = toBroccoliPlugin(packager);
  let variants = (options && options.variants) || defaultVariants(emberApp);
  return new BroccoliPackager(stage2, embroiderApp.root, variants, options && options.packagerOptions);
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
