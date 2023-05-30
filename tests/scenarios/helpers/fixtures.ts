import { join } from 'path';
import { readFileSync } from 'fs';
import globby from 'globby';
import { set } from 'lodash';

export function loadFromFixtureData(fixtureNamespace: string) {
  const root = join(__dirname, '..', '..', 'fixtures', fixtureNamespace);
  const paths = globby.sync('**', { cwd: root, dot: true });
  const fixtureStructure: any = {};

  paths.forEach(path => {
    set(fixtureStructure, path.split('/'), readFileSync(join(root, path), 'utf8'));
  });

  return fixtureStructure;
}
