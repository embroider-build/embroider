import type Package from './package';
import { getOrCreate } from './get-or-create';

export default class PackageCache {
  ownerOfFile(_file: string): Package | undefined {
    throw new Error('no real ownerOfFile');
  }
  resolve(_specifier: string, _from: Package): Package {
    throw new Error('no real resolve');
  }

  static shared(identifier: string) {
    return getOrCreate(shared, identifier, () => new PackageCache());
  }
}
const shared: Map<string, PackageCache> = new Map();
