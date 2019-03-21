# Contributing / Developing

## Run the test suite

1. Clone this repo.
2. Run `yarn compile` (or `yarn compile --watch`).
3. Run `yarn lint` and `yarn test`.

`yarn test` uses [Jest](https://jestjs.io/) to run multiple tests in parallel.
Unfortunately, for now you will still have to run `yarn compile` before running
the tests to compile the TypeScript code to JavaScript. 


## Use a local version of embroider to compile your projects

1. Clone this repo.
2. Run `yarn compile` (or `yarn compile --watch`).
3. In each of the `./packages/*` directories, run `yarn link`.
4. In your app, `yarn link @embroider/core` and the other packages you need.
