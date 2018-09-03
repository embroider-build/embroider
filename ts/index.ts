import App from './app';
import V1InstanceCache from './v1-instance-cache';
import { Tree } from 'broccoli-plugin';

export function vanillaBuild(emberApp, outputDir): Tree {
  let cache = new V1InstanceCache(emberApp);
  let vanillaApp = new App(emberApp.project.root, cache, outputDir);
  return vanillaApp.vanillaTree;
}
