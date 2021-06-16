import { PreparedApp } from 'scenario-tester';
import { join, sep } from 'path';
import { readFileSync } from 'fs';
import globby from 'globby';
import { set } from 'lodash';

export async function setupFastboot(app: PreparedApp, environment = 'development') {
  let result = await app.execute(`node node_modules/ember-cli/bin/ember build --environment=${environment}`);

  if (result.exitCode !== 0) {
    throw new Error(`failed to build app for fastboot: ${result.output}`);
  }

  const FastBoot = require('fastboot');

  let fastboot = new FastBoot({
    distPath: join(app.dir, 'dist'),
    resilient: false,
  });

  async function visit(url: string) {
    const jsdom = require('jsdom');
    const { JSDOM } = jsdom;
    let visitOpts = {
      request: { headers: { host: 'localhost:4200' } },
    };
    let page = await fastboot.visit(url, visitOpts);
    let html = await page.html();
    return new JSDOM(html);
  }

  return { visit };
}

export function loadFromFixtureData(fixtureNamespace: string) {
  const root = join(__dirname, '..', 'fixtures', fixtureNamespace);
  const paths = globby.sync('**', { cwd: root, dot: true });
  const fixtureStructure: any = {};

  paths.forEach(path => {
    set(fixtureStructure, path.split(sep), readFileSync(join(root, path), 'utf8'));
  });

  return fixtureStructure;
}
