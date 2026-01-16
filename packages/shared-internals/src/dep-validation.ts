import type Package from './package';

// For each package in the graph, discover all the paths to reach that package.
// That is, we're identifying all its consumers.
export function crawlDeps(startingPackage: Package): Map<Package, Package[][]> {
  let queue: { pkg: Package; path: Package[] }[] = [{ pkg: startingPackage, path: [] }];
  let seen = new Set<Package>();
  let results = new Map<Package, Package[][]>();
  for (;;) {
    let entry = queue.shift();
    if (!entry) {
      break;
    }
    let { pkg, path } = entry;

    let paths = results.get(pkg);
    if (paths) {
      paths.push(path);
    } else {
      results.set(pkg, [path]);
    }

    if (!seen.has(pkg)) {
      seen.add(pkg);
      for (let dep of pkg.dependencies) {
        if (pkg.categorizeDependency(dep.name) !== 'peerDependencies') {
          queue.push({ pkg: dep, path: [...path, pkg] });
        }
      }
    }
  }
  return results;
}

interface PeerDepViolation {
  // this package...
  pkg: Package;
  // sees this peer dep.
  dep: Package;
  // pkg was reached by this path of ancestors
  ancestors: Package[];
  // this particular ancestor...
  ancestor: Package;
  // provides a conflicting value for the peerDep
  ancestorsDep: Package;
}

export function validatePeerDependencies(appPackage: Package): PeerDepViolation[] {
  let violations = [];
  for (let [pkg, consumptions] of crawlDeps(appPackage)) {
    for (let dep of pkg.dependencies) {
      if (pkg.categorizeDependency(dep.name) === 'peerDependencies') {
        if (pkg.packageJSON.peerDependenciesMeta?.[dep.name]?.optional) {
          continue;
        }

        for (let ancestors of consumptions) {
          for (let ancestor of ancestors.slice().reverse()) {
            if (ancestor.hasDependency(dep.name)) {
              let ancestorsDep = ancestor.dependencies.find(d => d.name === dep.name)!;
              if (ancestorsDep !== dep && dep.isEmberAddon()) {
                violations.push({ pkg, dep, ancestors, ancestor, ancestorsDep });
              }
              continue;
            }
          }
        }
      }
    }
  }
  return violations;
}

export function summarizePeerDepViolations(violations: PeerDepViolation[]): string {
  let message = [];
  for (let { pkg, dep, ancestors, ancestor, ancestorsDep } of violations) {
    for (let [index, a] of ancestors.entries()) {
      message.push(packageIdSummary(a));
      if (index + 1 < ancestors.length) {
        message.push(displayConnection(a, ancestors[index + 1]));
      } else {
        message.push(displayConnection(a, pkg));
      }
    }
    message.push(packageIdSummary(pkg));
    message.push('\n');
    message.push(`    sees peerDep ${packageIdSummary(dep)}\n      at ${dep.root}\n`);
    message.push(
      `    but ${packageIdSummary(ancestor)} is using ${packageIdSummary(ancestorsDep)}\n      at ${
        ancestorsDep.root
      }\n\n`
    );
  }
  return message.join('');
}

function displayConnection(left: Package, right: Package) {
  if (left.packageJSON.dependencies?.[right.name]) {
    return ' -> ';
  }
  if (left.packageJSON.peerDependencies?.[right.name]) {
    return ' (peer)-> ';
  }
  if (left.packageJSON.devDependencies?.[right.name]) {
    return ' (dev)-> ';
  }
  return ' (?)-> ';
}

function packageIdSummary(pkg: Package): string {
  return `${pkg.name}@${pkg.version}`;
}
