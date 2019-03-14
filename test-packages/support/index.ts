import Project from 'ember-cli/lib/models/project';
import EmberApp from 'ember-cli/lib/broccoli/ember-app';
import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import MockUI from 'console-ui/mock';
import Instrumentation from 'ember-cli/lib/models/instrumentation';
import PackageInfoCache from 'ember-cli/lib/models/package-info-cache';

class MockCLI {
  ui: any;
  root: string;
  npmPackage: string;
  instrumentation: Instrumentation;
  packageInfoCache: PackageInfoCache;
  constructor(options?: any) {
    options = options || {};

    this.ui = options.ui || new MockUI();
    this.root = join(__dirname, '..', '..');
    this.npmPackage = options.npmPackage || 'ember-cli';
    this.instrumentation = options.instrumentation || new Instrumentation({});
    this.packageInfoCache = new PackageInfoCache(this.ui);
  }
}

export function emberApp(dir: string, userOpts: any = {}): any {
  let cli = new MockCLI();
  let project = new Project(dir, readJSONSync(join(dir, 'package.json',)), cli.ui, cli);
  return new EmberApp({ project }, userOpts);
}

export function emberTemplateCompilerPath() {
  return join(__dirname, 'vendor', 'ember-template-compiler.js');
}
