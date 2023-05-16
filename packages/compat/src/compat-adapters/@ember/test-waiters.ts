import V1Addon from '../../v1-addon';
import { satisfies } from 'semver';

export default class extends V1Addon {
  // our heuristic for detecting tree suppression can't deal with the way
  // test-waiters patches treeFor on other copies of its addon instances all
  // over the place. It causes us to falsely detect that it's trying to suppress
  // all tree output, reducing in empty copies.
  protected suppressesTree(_name: string): boolean {
    return false;
  }

  reduceInstances(instances: V1Addon[]): V1Addon[] {
    if (!satisfies(this.packageJSON.version, '>=3.0.2')) {
      throw new Error(
        `@ember/test-waiters cannot work safely under embroider before version 3.0.2 due to https://github.com/emberjs/ember-test-waiters/pull/388. You have a copy at version ${this.packageJSON.version}.`
      );
    }

    // we know test waiters tries to dedup itself, so there's no point in building
    // and smooshing many copies.
    return [instances[0]];
  }
}
