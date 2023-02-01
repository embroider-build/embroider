# Empty package in Embroider output

As part of Embroider build process traditional (v1) addons are rewritten to the new v2 format before building your application. Embroider can only tell what contents those packages should have by letting the traditional broccoli-based build pipelines run and observing the files that come out but this can be a bit tricky because there are some cases where broccoli won't run for a particular addon. 

There are several reasons an addon won't ever get consumed by broccoli, causing embroider to emit an empty package. Some of those reasons include:

- if an app uses `addons.blacklist` or `addons.exclude`, the excluded addon can end up empty since nobody consumed it
- if an addon uses the shouldIncludeChildAddon() hook to exclude a child addon, the child addon can end up empty
- if you have multiple copies of certain addons (`@ember/test-helpers` and `@ember/test-waiters` are known examples) within your `node_modules` tree, one copy may end up unconsumed, ending up empty
- if you use pnpm, you may not think you have multiple copies of an addon but still end up with multiple copies because pnpm is more strictly correct about peer dependencies. A library that should see two different peers when consumed from two different places will appear as two distinct copies to consumers.

## pnpm specific solution

You can read more about how pnpm deals with peerDependencies differently in the pnpm docs: https://pnpm.io/how-peers-are-resolved

If you are experiencing this problem in a monorepo you can probably use the config `dependenciesMeta.*.injected` for any shared monorepo package. This will prevent there from being extra duplicate peerDependencies created for shared peerDependencies like `@ember/test-helpers`. You can read more about this config in the pnpm documentation https://pnpm.io/package_json#dependenciesmetainjected
