# @embroider/dedupe

A command line tool that eliminates redundancy within your node_modules.

# Why?

Classic ember-cli doesn't support multiple copies of the same Ember addon within one app. This is often what you want, as duplication slows down your app. Unfortunately:
 - ember-cli gives you no control over the deduplication process
 - the results do not always satisfy the stated semver requirements of all the packages (you can get a dep that's outside the range you asked for)
 - there is no single clear winner -- all the copies are mashed together (!) so unless they happen to contain an identical set of modules, you will have some modules from one version and some modules from another.

Embroider _does_ support multiple copies of the same Ember addon within one app. It guarantees that each package will get the dependencies it asks for. That results in a more correct situation, but it introduces some new problems:
 - you will sometimes get more copies than you want.
 - some common addons (like ember-inflector) actually crash if you have more than one copy.

`dedupe` addresses these by pruning down your `node_modules` graph before you even start building your app.

# How

Each time you run `npm install` or `yarn install`, also run the `dedupe` command from this package. It modifies your `node_modules` directory through a combination of deleting packages and symlinking packages.

# Limitations

This package is not a full optimizer, in the sense of looking at all possible published versions of each package and solving for the smallest combination. Rather, it works only with the set of versions that are already present based on the output of `npm` or `yarn`.
