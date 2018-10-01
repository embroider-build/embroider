# Stack

 - write README, publish to npm, open repos
 - there's a weird babel bug that forced me to rename some locals in travis
 - I removed livereload-inject package. Will need to decide if we want to keep control over livereload (in which case we should make it work) or whether that is a final-stage-packager concern (in which case our real requirement is to do nice fine-grained updates of the Workspace and let the packager take over from there).
 - make sure we are following the same addon traversal order as ember-cli: https://github.com/ember-cli/ember-cli/pull/7979
 - when adding tests, see https://github.com/stefanpenner/node-fixturify-project (as used in ember-cli)


# apps to test

travis-web
ember observer
ghost?
ember-cli-eyeglass dummy app has engines: https://github.com/sass-eyeglass/ember-cli-eyeglass/tree/master/tests/dummy/lib

more demo apps that do engine-related stuff:
https://github.com/CodeOfficer/app-engine-addon-theme-demo
https://github.com/CodeOfficer/demo-engine-addon-dependency-conflicts

