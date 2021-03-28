import type { Node } from 'broccoli-node-api';
import { PackageCache } from '@embroider/shared-internals';

// A build Stage is _kinda_ like a Broccoli transform, and it interoperates with
// Broccoli, but it takes a different approach to how stages combine.
//
// Conceptually, normal broccoli transforms pass trees by value (meaning they
// always get copied) whereas Stages pass trees by reference (meaning they can
// be borrowed and mutated).
//
// This would be potentially bad if abused, but we are only using them for
// precisely three well-defined stages, where each has clear responsibilities.
//
export default interface Stage {
  // this is the broccoli tree that must get built for the Stage to be ready.
  // But! This tree's output path is _not_ necessarily where the Stage's output
  // will be, for that you must wait for `outputPath`.
  readonly tree: Node;

  // this is where our stage was reading from. Subsequent stages are also
  // allowed to read from here in addition to reading from our `outputPath`.
  readonly inputPath: string;

  // this promise is only guaranteed to resolve if you cause `tree` to be
  // included in a broccoli build.
  ready(): Promise<{
    // This is the actual directory in which the output will be. It's guaranteed
    // to not change once you get it.
    readonly outputPath: string;

    // This optionally allows the Stage to share a PackageCache with the next
    // Stage, as an optimization. If the Stage uses a PackageCache, it _should_
    // share it here.
    readonly packageCache?: PackageCache;
  }>;
}
