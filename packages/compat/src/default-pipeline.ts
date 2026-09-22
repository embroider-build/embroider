import type { Options } from '.';
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
import chalk from 'chalk';

export interface PipelineOptions<PackagerOptions> extends Options {
  packagerOptions?: PackagerOptions;
  onOutputPath?: (outputPath: string) => void;
  variants?: Variant[];
}

function warnEmbroiderV3Deprecated(emberApp: EmberAppInstance): void {
  const isDummyApp = emberApp.project.pkg.keywords?.includes('ember-addon') ?? false;
  const deprecationMessage = (
    isDummyApp
      ? [
          `This addon's dummy app builds with Embroider@3, which is deprecated.`,
          `  * No new features or bugfixes will be released.`,
          `  * Security fixes will be backported only while Ember v6.12 remains an active LTS.`,
          `  * Your ember-try embroider scenarios will not work with Ember v7.`,
          ``,
          `Migrate to the v2 addon format:`,
          `  https://github.com/embroider-build/embroider/blob/main/docs/porting-addons-to-v2.md`,
        ]
      : [
          `This app builds with Embroider@3, which is deprecated.`,
          `  * No new features or bugfixes will be released.`,
          `  * Security fixes will be backported only while Ember v6.12 remains an active LTS.`,
          `  * You must migrate before upgrading to Ember v7.`,
          ``,
          `Migrate to Vite with the ember-vite-codemod:`,
          `  https://github.com/mainmatter/ember-vite-codemod`,
        ]
  )
    .concat([``, `See the deprecation RFC for details:`, `  https://rfcs.emberjs.com/id/1187-deprecate-embroider-3`])
    .join('\n');

  console.warn(`\n${chalk.yellow(deprecationMessage)}\n`);
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

  warnEmbroiderV3Deprecated(emberApp);

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
