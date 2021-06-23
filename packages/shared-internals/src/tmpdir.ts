import { realpathSync } from 'fs-extra';
import { tmpdir } from 'os';

// tmpdir() can point to a symlink such as `/var/folders/9n/...` which points
// to `/private/var/folders/9n/...`. Although these are logically the same
// folder, some algorithms operating on the path will not be aware of this and
// treat them differently. So rather then mixing, let's create a shared tmpdir
// value that has already had its real path derived.
//
// Additionally, it is slightly odd to repeatedly ask for `tmpdir()` when the
// in-process expectation is that it remains stable. So storing it as a value
// here should be safe.
export default realpathSync(tmpdir());
