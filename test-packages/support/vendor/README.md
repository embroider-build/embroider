This is vendored from ember 3.8.0.

I did it this way because if I try to depend directly on ember-source, I end up with a version of fs-tree-diff that has bad types in it that messes up my build.

Also, I backported https://github.com/glimmerjs/glimmer-vm/pull/932 into it. That bug doesn't directly effect the use of macros in real apps, because they only happen in stage3 and never get re-printed. But in our test suite we do re-print their output.