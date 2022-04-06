# Contributing / Developing

## Preparing for local development

1. Clone this repo.
2. Run `yarn install`. This will also trigger a typescript compile.
3. If you edit the typescript, you will need to compile again via `yarn compile` or `yarn compile --watch`.

## Running lints

`yarn lint` at the top of the monorepo will lint everything.

## Running tests

Tests can be run per-package, or combined all together.

Per-package test suites are defined as the `yarn test` command within each `packages/*` or `test-packages/*`.

The combined suite can be run via the top-level `yarn test` command. It's defined by combining

- all the `yarn test:*` commands within each `packages/*` or `test-packages/*`. These are typically complete Ember apps that need to get built and tested in the browser.
  - we have special handling for `ember try:each`. When you use the top-level `yarn test` locally we _don't_ run these by default, because they can't be parallelized easily. If you want to run them, just go into the specific package you care about and run `ember try:each` there.
- all Jest tests that are configured in the entire monorepo. These are typically Node unit & integration tests of the build tooling.

When you run the combined test suite locally, we emit Jest stubs for each of the various suites so that everything runs together under Jest.

When we run the combined suite in GitHub, we emit separate jobs for each separate test suite.

## Test Maintenance

In the tests directory we derive our tests off of base app and addon templates (located at tests/app-template and tests/addon-template). These base templates should be updated every new LTS release of ember in order to bring in the latest template changes and project dependencies. It is recommended to run `ember-cli-update` inside of these directories in order to bring them up to date. Lastly, tests/scenarios.ts should correctly represent our support matrix so new LTS versions should be added at the same time as template updates.

## Use a local version of embroider to compile your projects

1. Clone this repo.
2. Run `yarn compile` (or `yarn compile --watch`).
3. In each of the `./packages/*` directories, run `yarn link`.
4. In your app, `yarn link @embroider/core` and any other embroider packages that appear in your package.json.
