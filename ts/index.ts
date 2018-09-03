import App from './app';
import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { Packager, PackagerInstance, PackagerOptions } from './packager';
import PackagerRunner from './packager-runner';

export { Packager, PackagerInstance, PackagerOptions };

export function vanillaBuild(emberApp, outputDir): Tree {
  let cache = new V1InstanceCache(emberApp);
  let vanillaApp = new App(emberApp.project.root, cache, outputDir);
  return vanillaApp.vanillaTree;
}

export function build(emberApp, packagerClass: Packager): Tree {
  let cache = new V1InstanceCache(emberApp);
  let workspaceDir = mkdtempSync(join(tmpdir(), 'ember-cli-vanilla-'));
  let app = new App(emberApp.project.root, cache, workspaceDir);
  return new PackagerRunner(packagerClass, app);
}
