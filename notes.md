# Stack

2. get rid of publicly visible appJSPath on App. Doesn't make sense there as a concept. Instead, make the v1-app rewrite index.html into using a standard script name. It can use options.outputPaths to figure out which script tags its replacing. We're not going to generate a separate vendor.js, splitting is the responsibility of the final packager.


# taking over from EmberApp

ember-cli eagerly instantiates all addons pretty much whatever you are doing. So even when you have all v2 packages, you're going to be using their v1 shims a lot until we can refactor ember-cli around v2 internally.

Defer working on this until we have proved out the compatibility and have working builds.

# apps to test

travis-web
ember observer
ghost?
ember-cli-eyeglass dummy app has engines: https://github.com/sass-eyeglass/ember-cli-eyeglass/tree/master/tests/dummy/lib

more demo apps that do engine-related stuff:
https://github.com/CodeOfficer/app-engine-addon-theme-demo
https://github.com/CodeOfficer/demo-engine-addon-dependency-conflicts

# more node_modules linking strategy

We will always have some dynamic things plus static node_modules.

When the dynamic things are just your app, it's not that hard because you can put the dynamic things in a subdir and they retain access to all the same node_modules. Critically, no other packages depend on you, so they don't need to be updated to point at your dynamically-rebuilt package.

The harder case is when you're dynamic and other things do depend on you (a v1 addon).

Perhaps we should make a complete separate node_modules tree with our dynamic output plus symlinks into the static tree. The naive solution wouldn't work (you can't

# shadow node_modules thoughts

can we construct a shadow node_modules to handle the v1-to-v2 compiled addons or should we do in-place replacement of them?

shadow is annoying to make work in both directions (from shadow to real and real to shadow). It's not too bad when packages are same-level in the filesystem (you can override the real copy by placing symlinks into the nested node_modules of each of the packages that depend on it). But when you're already nested, there's no higher-priority place to put the symlink. Probalby in that case you need to copy the dependee into shadow too.

two-way shadow involves editing inside of the real node_modules, so maybe it's not worth trying to avoid in-place replacement.

we can make it only go one way if we copy a lot more stuff into shadow (anything that depends on a v1-to-v2 compiled package). That's unfortunate because a single v1 addon imposes the cost on everyone.

in-place replacement seems intrusive, but more understandable and performant. Can do atomic replacement, depth-first.

but in-place works best as a one-shot thing you do after npm install, not so good if we are doing incremental rebuilds of legacy addons with dynamic behaviors that haven't been ported to v2. Perhaps we can make it work well by having a well-known place to keep the original, and some explicit relationship between the original and the v2 such that we will notice and rebuild when NPM runs again and undoes our work.

tentative conclusion: go with in-place replacement.
  1. Not every up-compiled package will need rebuilds. If it doesn't implement any custom hooks, we know it doesn't. So a one-shot atomic replacement is sufficient. The atomic replacment should be all packages at once: we will build everything separately first.
  2. That is the initial case I'm working with anyway, so go with that.
  3. Later we can add a dynamically rebuilding strategy that keeps the original v1 around in a nested `.ember-cli-vanilla-v1` folder (nested so it retains access to the same node_modules).

NEXT: keep working on the build step, without worrying about inter-module resolution yet, knowing that we will do an atomic replace step at the end.


