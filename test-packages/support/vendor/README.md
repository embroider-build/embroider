This is vendored from ember 5.0.0-beta.3. If you upgrade it, also update the version number in ./index.js

I did it this way because if I try to depend directly on ember-source, I end up with a version of fs-tree-diff that has bad types in it that messes up my build.
