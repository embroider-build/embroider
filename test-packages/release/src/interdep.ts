import glob from 'globby';
import { resolve, join } from 'path';
import { readFileSync, readJSONSync } from 'fs-extra';
import yaml from 'js-yaml';

export type Range = `workspace:${string}`;

export interface PkgEntry {
  version: string;
  pkgJSONPath: string;
  isDependencyOf: Map<string, Range>;
  isPeerDependencyOf: Map<string, Range>;
}

export function publishedInterPackageDeps(): Map<string, PkgEntry> {
  let rootDir = resolve(__dirname, '..', '..', '..');
  let packages: Map<string, PkgEntry> = new Map();

  let pkgJSONS: Map<string, any> = new Map();

  for (let pattern of (yaml.load(readFileSync(resolve(__dirname, '../../../pnpm-workspace.yaml'), 'utf8')) as any)
    .packages) {
    for (let dir of glob.sync(pattern, { cwd: rootDir, expandDirectories: false, onlyDirectories: true })) {
      let absolutePkgJSONPath = resolve(rootDir, dir, 'package.json');
      let pkg = readJSONSync(absolutePkgJSONPath);
      if (pkg.private) {
        continue;
      }
      pkgJSONS.set(pkg.name, pkg);
      packages.set(pkg.name, {
        version: pkg.version,
        pkgJSONPath: join(dir, 'package.json'),
        isDependencyOf: new Map(),
        isPeerDependencyOf: new Map(),
      });
    }
  }

  for (let [consumerName, consumerPkgJSON] of pkgJSONS) {
    // no devDeps because changes to devDeps shouldn't ever force us to
    // release
    for (let section of ['dependencies', 'peerDependencies'] as const) {
      if (consumerPkgJSON[section]) {
        for (let [depName, depRange] of Object.entries(consumerPkgJSON[section] as Record<string, string>)) {
          if (depRange.startsWith('workspace:')) {
            let dependency = packages.get(depName);
            if (!dependency) {
              throw new Error(`broken "workspace:" reference to ${depName} in ${consumerName}`);
            }
            let field = section === 'dependencies' ? ('isDependencyOf' as const) : ('isPeerDependencyOf' as const);
            dependency[field].set(consumerName, depRange as Range);
          }
        }
      }
    }
  }
  return packages;
}
