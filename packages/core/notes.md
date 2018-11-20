# Stack
 - make app's babel config gen smarter
   - reverse engineer _parallelBabel (it seems to invoke inline-precompile, for example)
   - attempt to map already-resolved functions back to their sources
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


