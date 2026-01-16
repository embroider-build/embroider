# Contributing / Developing

## Preparing for local development

0. `export VOLTA_FEATURE_PNPM=1` in your shell, because [Volta's PNPM support](https://github.com/volta-cli/volta/issues/737) is behind a feature flag for the present.
1. Clone this repo.
2. Run `pnpm install`. This will also trigger a typescript compile.
3. If you edit the typescript, you will need to compile again via `pnpm compile` or `pnpm compile --watch`.

## Running lints

`pnpm lint` at the top of the monorepo will lint everything.

## Running tests

Tests can be run per-package, or combined all together.

Per-package test suites are defined as the `pnpm test` command within each `packages/*` or `test-packages/*`.

The combined suite can be run via the top-level `pnpm test` command. It's defined by combining

- all the `pnpm test:*` commands within each `packages/*` or `test-packages/*`. These are typically complete Ember apps that need to get built and tested in the browser.
  - we have special handling for `ember try:each`. When you use the top-level `pnpm test` locally we _don't_ run these by default, because they can't be parallelized easily. If you want to run them, just go into the specific package you care about and run `ember try:each` there.
- all Jest tests that are configured in the entire monorepo. These are typically Node unit & integration tests of the build tooling.

When you run the combined test suite locally, we emit Jest stubs for each of the various suites so that everything runs together under Jest.

When we run the combined suite in GitHub, we emit separate jobs for each separate test suite.

## Working with tests scenarios

1. `cd tests/scenarios`
2. `pnpm test:list` to figure out the full name of the scenario you want. eg: `release-engines-without-fastboot`.
3. `pnpm test:output --scenario release-engines-without-fastboot --outdir /path/to/wherever`. This will create the scenario as a standalone project in `/path/to/wherever`.
4. `cd /path/to/wherever` && `pnpm start` to boot and debug the ember app.

## Test Maintenance

In the tests directory we derive our tests off of base app and addon templates (located at tests/app-template and tests/addon-template). These base templates should be updated every new LTS release of ember in order to bring in the latest template changes and project dependencies. It is recommended to run `ember-cli-update` inside of these directories in order to bring them up to date. Lastly, tests/scenarios.ts should correctly represent our support matrix so new LTS versions should be added at the same time as template updates.

## Use a local version of embroider to compile your projects

1. Clone this repo.
2. Run `pnpm compile` (or `pnpm compile --watch`).
3. In each of the `./packages/*` directories, run `pnpm link`.
4. In your app, `pnpm link @embroider/core` and any other embroider packages that appear in your package.json.

## Issue Triage

Triaging issues and Pull Requests is a great way to help maintainers out, as it highly async communication, and benefits users of projects within this repo, past, present, and feature.

The goal helping out with issue/pr triage is to efficiently and asynchronously communicate if anything needs attention -- all without opening a new tab for each issue/pr and reading the whole history. 

Triage tasks can fall in to the following categories:

### Issue: Request or Create a Reproduction

If an issue is reported, but does not have a clear path to resolution, we need a reproduction that demonstrates the issuse in a clear and concise way.  
[StackOverflow has a good process](https://stackoverflow.com/help/minimal-reproducible-example) for creating minimal reproductions.

The following labels should be added / removed, depending on the state of the issue: 

- `needs reproduction` - a reproduction repo or failing test is still needed
- `has reproduction` - no additional reproduction needed, the problem is clearly demonstrated in an isolated and understable way

### Issue: Confirm problem is present in current release 

Once a reproduction exists for an issue, we can re-run the reproduction steps with the current release, and if the problem is resolved, we can close the issue. 

If the issue is still present, the label `confirmed issue` can be added to the issue.

### Issue: Problem confirmed, needs fix

When an issue is confirmed, and isn't potentially a user error, or configuration problem, the label `bug` can be added to the issue.

### Pull Request: reproduction 

In some cases, pull requests are used to demonstrate a problem via failing test -- these pull requsets need a fix / resolution to be implemented.


To represent this state, the labels, `needs fix`, and `is reproduction` could be applied to the PR

### Pull Request: others

All other PRs' states are represented by GitHub-native status, reviewed, approved, etc.
When a PR is approved by `embroider` maintainers, it could be considered ready for merge once CI passes.




