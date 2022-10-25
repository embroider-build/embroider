import QUnit from 'qunit';
import glob from 'globby';
import { resolve } from 'path';
import { readJSONSync } from 'fs-extra';
import { satisfies } from 'semver';

const { module: Qmodule, test } = QUnit;

Qmodule('package inter-version consistency', () => {
  let rootDir = resolve(__dirname, '..', '..');
  let packages = new Map();
  for (let pattern of readJSONSync(resolve(__dirname, '../../package.json')).workspaces.packages) {
    for (let dir of glob.sync(pattern, { cwd: rootDir, expandDirectories: false, onlyDirectories: true })) {
      let pkg = readJSONSync(resolve(rootDir, dir, 'package.json'));
      packages.set(pkg.name, pkg);
      test(pkg.name, assert => {
        assert.ok('some packages have no interior deps and that is ok');
        for (let section of ['dependencies', 'devDependencies', 'peerDependencies']) {
          for (let [name, range] of Object.entries(pkg[section] ?? {})) {
            let other = packages.get(name);
            if (other) {
              assert.ok(
                satisfies(other.version, range as string),
                `${name} in ${section} ${other.version} does not satisfy ${range}`
              );
            }
          }
        }
      });
    }
  }
});
