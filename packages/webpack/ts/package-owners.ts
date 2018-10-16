import { sync as pkgUpSync }  from 'pkg-up';
import { dirname } from 'path';
import { Memoize } from 'typescript-memoize';

class PackageEntry {
  constructor(private packagePath) {}

  @Memoize()
  get packageJSON() {
    return require(this.packagePath);
  }

  get name() {
    return this.packageJSON.name;
  }

  @Memoize()
  get root() {
    return dirname(this.packagePath);
  }
}

export default class PackageOwners {
  private knownPackages = new Map();

  lookup(filename) {
    let segments = filename.split('/');
    for (let length = segments.length - 1; length >= 0; length--) {
      if (segments[length-1] === 'node_modules') {
        // once we hit a node_modules, we're leaving the package we were in, so
        // any higher caches don't apply to us
        break;
      }
      let candidate = segments.slice(0, length).join('/');
      if (this.knownPackages.has(candidate)) {
        return this.knownPackages.get(candidate);
      }
    }
    let packagePath = pkgUpSync(filename);
    let entry = new PackageEntry(packagePath);
    this.knownPackages.set(dirname(packagePath), entry);
    return entry;
  }
}
