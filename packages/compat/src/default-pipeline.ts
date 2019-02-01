import { App, AppOptions, Addons as CompatAddons } from '.';
import { toBroccoliPlugin, PrebuiltAddons, Packager } from '@embroider/core';
import { Tree } from 'broccoli-plugin';

interface PipelineOptions<PackagerOptions> extends AppOptions {
  packagerOptions?: PackagerOptions;
}

export default function defaultPipeline<PackagerOptions>(
  emberApp: object,
  packager: Packager<PackagerOptions>,
  options?: PipelineOptions<PackagerOptions>
): Tree {
  let addons;
  if (process.env.REUSE_WORKSPACE) {
    addons = new PrebuiltAddons(__dirname, '/tmp/embroider-workspace');
  } else {
    addons = new CompatAddons(emberApp, {
      workspaceDir: '/tmp/embroider-workspace',
    });
    addons.ready().then(result => {
      console.log(`Building into ${result.outputPath}`);
    });
  }

  if (process.env.STAGE1_ONLY) {
    return addons.tree;
  }

  let embroiderApp = new App(emberApp, addons, {
    extraPublicTrees: options && options.extraPublicTrees,
  });

  if (process.env.STAGE2_ONLY) {
    return embroiderApp.tree;
  }

  let BroccoliPackager = toBroccoliPlugin(packager);

  return new BroccoliPackager(embroiderApp, options && options.packagerOptions);
}
