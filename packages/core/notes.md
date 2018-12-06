# Stack
 - keep refactoring compat-app bottom up.
 - our use of "entrypoint" in the spec is weird relative to common usage, let's change it to "asset" and keep "entrypoint" only for URLs users would visit
 - optimize the workspace compat-app build hook for rebuilds
 - generalize the derequire transformation. Probably applies to everything other than our own synthesized entrypoints.
   - this implies generalizing split babel configs (we don't really want to apply the app's plugins to addon code unnecessarily anyway)
 - finish making every legacyTrees into a protected method so it can be overidden
 - start documenting things addons do that are impossible to patch over
  - having the same import do different things in test and non-test
    (ember-window-mock). Solution is an API for importing and installing the
    test behavior explicitly from test code.
 - there's a weird babel bug that forced me to rename some locals in travis
 - make sure we are following the same addon traversal order as ember-cli: https://github.com/ember-cli/ember-cli/pull/7979
 - when adding tests, see https://github.com/stefanpenner/node-fixturify-project (as used in ember-cli)


# Introduce flags

allowNonSerializableASTPlugins: only downside today will be inability to run final stage in separate process. May want to parallelize though in future.

allowNonSerializableBabelPlugins: performance hit, this one is worth creating workarounds to reverse engineer plugins when possible and let people provide hints. May need new instrumentation around plugin registration in ember-cli

forceIncludeAddonTrees: force include everything from the addon trees. Eliminates need for some of our compat-adapters, though we would keep them anyway to help more people not need the flag.

forceIncludeComponents

forceIncludeHelpers (worth splitting out from components because there’s no “helper” helper)

# Vendor coodination

Vendor coordination: we can compile vendor files into a separate synthetic package, such that they are shared and deduplicated in a compatible way.



