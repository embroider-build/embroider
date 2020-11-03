import { App, Addons as CompatAddons, Options, PrebuiltAddons } from '.';
import { toBroccoliPlugin, Packager, Variant } from '@embroider/core';
import { Tree } from 'broccoli-plugin';
import writeFile from 'broccoli-file-creator';
import mergeTrees from 'broccoli-merge-trees';

interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  onOutputPath?: (outputPath: string) => void;
  variants?: Variant[];
}

export default function defaultPipeline<PackagerOptions>(
  emberApp: object,
  packager: Packager<PackagerOptions>,
  options?: PipelineOptions<PackagerOptions>
): Tree {
  let outputPath: string;
  let addons;
  if (process.env.REUSE_WORKSPACE) {
    addons = new PrebuiltAddons(emberApp, options, process.env.REUSE_WORKSPACE);
  } else {
    if (process.env.SAVE_WORKSPACE) {
      if (!options) {
        options = {};
      }
      options.workspaceDir = process.env.SAVE_WORKSPACE;
    }
    addons = new CompatAddons(emberApp, options);
    addons.ready().then(result => {
      if (options && options.onOutputPath) {
        options.onOutputPath(result.outputPath);
      } else {
        console.log(`Building into ${result.outputPath}`);
      }
      outputPath = result.outputPath;
    });
  }

  if (process.env.STAGE1_ONLY) {
    return mergeTrees([addons.tree, writeFile('.stage1-output', () => outputPath)]);
  }

  let embroiderApp = new App(emberApp, addons, options);

  if (process.env.STAGE2_ONLY) {
    return mergeTrees([embroiderApp.tree, writeFile('.stage2-output', () => outputPath)]);
  }

  let BroccoliPackager = toBroccoliPlugin(packager);
  let variants = (options && options.variants) || defaultVariants(emberApp);
  return new BroccoliPackager(embroiderApp, variants, options && options.packagerOptions);
}

function hasFastboot(emberApp: any) {
  return emberApp.project.addons.find((a: any) => a.name === 'ember-cli-fastboot');
}

function defaultVariants(emberApp: any): Variant[] {
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
      runtime: 'all',
      optimizeForProduction: false,
    });
  }
  return variants;
}
