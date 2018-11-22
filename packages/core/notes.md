# Stack
 - re-enable AST transforms
   - like our babel config, we may want to enforce stricter serializability here
   - that could require some compatibility heroics in terms of code analysis to reverse functions to their import sources
 - finish making every legacyTrees into a protected method so it can be overidden
 - start documenting things addons do that are impossible to patch over
  - having the same import do different things in test and non-test
    (ember-window-mock). Solution is an API for importing and installing the
    test behavior explicitly from test code.
 - there's a weird babel bug that forced me to rename some locals in travis
 - make sure we are following the same addon traversal order as ember-cli: https://github.com/ember-cli/ember-cli/pull/7979
 - when adding tests, see https://github.com/stefanpenner/node-fixturify-project (as used in ember-cli)


