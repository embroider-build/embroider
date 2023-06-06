import { App, Addons as CompatAddons, Options } from '.';
import { toBroccoliPlugin, PackagerConstructor, Variant, EmberAppInstance } from '@embroider/core';
import { tmpdir } from '@embroider/core';
import { Node } from 'broccoli-node-api';
import writeFile from 'broccoli-file-creator';
import mergeTrees from 'broccoli-merge-trees';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { sync as pkgUpSync } from 'pkg-up';

export interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  onOutputPath?: (outputPath: string) => void;
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

  options.workspaceDir = stableWorkspaceDir(emberApp.project.root, emberApp.env);

  emberApp.project.ui.write(`Building into ${options.workspaceDir}\n`);

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
