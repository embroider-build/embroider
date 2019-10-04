import { App, Addons as CompatAddons, Options, PrebuiltAddons } from '.';
import { toBroccoliPlugin, Packager, AppBuilder } from '@embroider/core';
import { Tree } from 'broccoli-plugin';

interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  onOutputPath?: (outputPath: string) => void;
}

export default function defaultPipeline<PackagerOptions>(
  emberApp: object,
  packager: Packager<PackagerOptions>,
  options?: PipelineOptions<PackagerOptions>
): Tree {
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
    });
  }

  AppBuilder.finalizeMacroConfig(emberApp);
  if (process.env.STAGE1_ONLY) {
    return addons.tree;
  }

  let embroiderApp = new App(emberApp, addons, options);

  if (process.env.STAGE2_ONLY) {
    return embroiderApp.tree;
  }

  let BroccoliPackager = toBroccoliPlugin(packager);

  return new BroccoliPackager(embroiderApp, options && options.packagerOptions);
}
