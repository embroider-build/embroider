# Peer Dependency Resolution Issues

Embroider may link you to this document if it finds certain bad peer dependency resolutions in your node_modules.

## What do you mean by "bad peer dependency?"

When `my-example-lib` declares `{ "peerDependencies" { "my-example-peer": "^1.0.0" } }`, it means:

 1. `my-example-lib` needs a version of `my-example-peer` that satisfies `^1.0.0`.
 2. And `my-example-lib` must see **the same copy** of `my-example-peer` that consumers of `my-example-lib` see.

A peer dependency can be bad if either of these conditions is violated. It can be missing entirely, it can be a wrong version, or it can be the right version but the wrong copy.

## How do bad peer deps happen?

### A dependency might not handle its own dependencies' peers clearly

Given the example names from above (`my-example-lib` has a peerDep on `my-example-peer`):

If some other package named `another-lib` puts `my-example-lib` into its dependencies, then `another-lib` is obligated to either:
 - put `my-example-peer` into its own peerDependencies, so that users of `another-lib` are aware of the need to provide this shared package to keep `my-example-lib` working.
 - or put `my-example-peer` into its own dependencies, producing an entirely self-contained use of `my-example-peer`. This is only appropriate if it's totally fine that users of `another-lib` might get duplicate copies of `my-example-peer` if they happen to use it elsewhere.

If `another-lib` does neither of those things, the package manager is free to arbitrarily install a duplicate copy of `my-example-peer` or not provide it at all. If all the version ranges happen to overlap, often things will work out by luck, only to fail mysteriously later when someone upgrades a dependency and they no longer overlap.

If your library uses a library that declares peer dependencies, those peer dependencies are fundamentally part of your library's own public API. Your users need to know and care about them. This is why it's clearest if you declare them as your own peers transitively.

### Package Manager Bugs

npm, yarn, and pnpm can all produce invalid peer dependencies sometimes. It is especially common in monorepo setups.

Node's architecture for dependency resolution originally assumed that it's better to always duplicate things rather than help users solve the difficult-but-important problem of getting a set of dependencies to agree on shared versions of shared infrastructure. That *kinda* worked for server-side-only applications. For frontend applications it's just not tenable. Nobody wants seven copies of Ember or React in their frontend application.

### Duplicate copies of the same dependency version in `node_modules/.pnpm`

pnpm tries harder than the other clients to actually give each library the correct peer dependencies. This can cause it to duplicate a package if the package needs to see different peers when consumed in different places within the dependency graph. 

This is genuinely correct behavior, but it can confuse people who aren't expecting it. Often a duplicated dependency is the symptom of a problem elsewhere -- one of the consumers of the duplicated package isn't doing the right thing with peer dependencies.

You may want to investigate pnpm's [options for adjusting peer dependency handling](https://pnpm.io/npmrc#peer-dependency-settings). Be aware that auto-install-peers sounds nice, but when some of your dependencies fail to handle their own dependencies' peers correctly, it can result in very surprising behaviors (like pnpm deciding to install a whole second copy of Ember, on a different major version than the one you're trying to use).

## How can I workaround these problems?

Sometimes it's as simple as deleting your lockfile and recreating it from scratch. This allows your package manager to do more optimization and that can often deduplicate things enough that the problem goes away.

Tools like [pnpm dedupe](https://pnpm.io/cli/dedupe) and [yarn-deduplicate](https://www.npmjs.com/package/yarn-deduplicate) can achieve a similar effect.

You can use [pnpm overrides](https://pnpm.io/package_json#pnpmoverrides), [yarn selective dependency resolutions](https://classic.yarnpkg.com/en/docs/selective-version-resolutions/), or [npm overrides](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#overrides) to manually adjust versions until things settled onto one copy.

You can satisfy a missing peer dependency by adding it to your application, and potentially also adjusting settings like [pnpm's resolve-peers-from-workspace-root](https://pnpm.io/npmrc#resolve-peers-from-workspace-root).

In monorepo setups, you can use pnpm's [peerDependenciesMeta.*.injected](https://pnpm.io/package_json#dependenciesmetainjected) to make your workspaces see correct peer dependencies (at the cost of needing to maintain per-file hardlinks, see [discussion on pnpm issue](https://github.com/pnpm/pnpm/issues/6088#issuecomment-1634302377)).

