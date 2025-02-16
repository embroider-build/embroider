import { readFileSync } from 'fs';
import { createRequire } from 'node:module';
import { join } from 'path';
import broccoli from 'broccoli';
const require = createRequire(import.meta.url);

const EmberApp = require('ember-cli/lib/broccoli/ember-app.js');
const Project = require('ember-cli/lib/models/project.js');
const CLI = require('ember-cli/lib/cli/cli.js');
const Compat = require('@embroider/compat');

export async function prebuild() {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const UI = require('console-ui');
  let ui = new UI({
    inputStream: process.stdin,
    outputStream: process.stdout,
  });

  let cli = new CLI({
    ui,
    testing: true,
    name: 'ember',
    disableDependencyChecker: true,
    root,
    npmPackage: 'ember-cli',
    initInstrumentation: undefined,
  });

  let project = new Project(root, pkg, ui, cli);
  let app = new EmberApp({ project });
  let builder = new broccoli.Builder(Compat.prebuild(app, { staticEmberSource: true }));

  await builder.build();
}
