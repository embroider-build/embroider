# Stack

 - generalized import renaming:
    -  already have this for packages that depend on addons that rename themselves
    -  need it also for things that show up in addon-test-support trees under nonstandard names
    -  it's OK to only support renaming inside v1 packages. if you want to update to v2 but one of your deps is renaming its files, you can import the real names directly as part of your v2 upgrade.
    -  the new feature here is that we don't know the full set of names needed until after building.

 - finish making every legacyTrees into a protected method so it can be overidden
 - start documenting things addons do that are impossible to patch over
  - having the same import do different things in test and non-test
    (ember-window-mock). Solution is an API for importing and installing the
    test behavior explicitly from test code.
 - document how to use build-time-config to strip even static imports
  - we need slightly stronger semantics for our code block stripping. It should also strip the corresponding import statements that are used only inside the stripped block. This means you're not allowed to rely on the side-effects of the import.

 - next is tests.html entrypoint
 - write README, publish to npm, open repos
 - there's a weird babel bug that forced me to rename some locals in travis
 - I removed livereload-inject package. Will need to decide if we want to keep control over livereload (in which case we should make it work) or whether that is a final-stage-packager concern (in which case our real requirement is to do nice fine-grained updates of the Workspace and let the packager take over from there).
 - make sure we are following the same addon traversal order as ember-cli: https://github.com/ember-cli/ember-cli/pull/7979
 - when adding tests, see https://github.com/stefanpenner/node-fixturify-project (as used in ember-cli)


