# Guide: Porting an Addon to V2

This is a guide for addon authors who want to publish their addon in **v2 format**.

> The actual V2 Format RFC only cares what format you **publish** to NPM. It doesn't necessarily care about your **authoring** format or toolchain. But in this guide, we are picking good defaults, and we hope to polish this experience until it's ready to become a new RFC as the default new Ember Addon authoring blueprint.

## What Addons should and should not be converted to V2?

The best candidates to convert to V2 are addons that provide only run-time features, like components, helpers, modifiers, and services. That kind of addon should definitely port to V2.

In contrast, addons that are primarily an extension to the build system (like `ember-cli-sass` or `ember-cli-typescript`) are not good candidates to be V2 addons, at present. V1 addons will continue to work through `@embroider/compat` for Embroider apps.

If your addon is a mix of both build-time and run-time features, consider replacing the build-time features with `@embroider/macros`. This would let you drop all your custom build-time code and port to V2. Alternatively, if you really need build customizations, you can provide users with instructions and utilities (like a webpack rule or plugin) to add those customizations to their Embroider build. We do _not_ let V2 addons automatically manipulate the app's build pipeline. Thar be dragons.

## Monorepo Organization

Traditionally, an Ember addon is a single NPM package that combines both the actual addon code _and_ a "dummy" app for hosting tests and docs. This was [problematic for several reasons](https://github.com/ember-cli/rfcs/issues/119). V2 addons instead require clean separation between addon and app, so you're going to be working with more than one distinct NPM package: one for the addon, one for the test-app, and optionally one for the documentation site.

Our recommended way to manage these multiple packages is using a monorepo, via pnpm, Yarn, or npm workspaces. The example in this guide assumes a pnpm workspaces monorepo because it's a good solution to work with Embroider in general.

## Part 1: Separate Addon from Dummy App

In this part of the guide, our goal is to separate our existing V1 addon from its "dummy" app and rename the dummy app to "test-app". At the end of this part, you will still have a V1 addon but it will be independent of its test-app, making it much easier to convert to V2 format in a subsequent Part.

For a complete example of a PR that performed these steps on a real addon, see https://github.com/ember-cli/ember-page-title/pull/227.

The steps:

1. Delete `pnpm-lock.yaml`.

1. At the top-level of your repo, make new directories named `test-app` and `_addon`

1. Move these files and directories into `_addon`

   - addon
   - addon-test-support
   - app
   - blueprints
   - config/environment.js (moves to `_addon/config/environment.js`)
   - index.js

1. Now you can rename `_addon` to `addon` without a name collision.

   - yes, this means you will have an `addon/addon` directory. This looks silly, but it will go away when we finish porting the addon to v2.

1. These things stay at the top level:

   - .git
   - .github
   - changelog, code of conduct, contributing, license, and readme

   Move **everything else** into `test-app`

1. Move everything under `test-app/tests/dummy` to directly under `test-app` instead.

   - for example, `test-app/tests/dummy/app` becomes `test-app/app`
   - you will be merging config directories because both `test-app/config` and `test-app/tests/dummy/config` will exist at the start of this step. They shouldn't have any file collisions because you already moved the one colliding file (`environment.js`) to `addon/config/environment.js` in a previous step.

1. Make a new top-level package.json for our new monorepo:

   ```json
   {
     "private": true,
     "workspaces": ["addon", "test-app"]
   }
   ```

   With pnpm, the workspace packages must also be described in [`pnpm-workspace.yaml`](https://pnpm.io/pnpm-workspace_yaml):

   ```yaml
   packages:
     - 'addon'
     - 'test-app'
   ```


1. Make a new top-level .gitignore:

   ```
   # you definitely want this:
   node_modules

   # and you can put in anything else that tends to accumulate in your environment:
   .pnpm-debug.log
   .DS_Store
   ```

1. Copy `test-app/package.json` to `addon/package.json`
1. Edit `addon/package.json` to remove all `devDependencies`, `scripts`, and `ember-addon.configPath`.
1. Edit `test-app/package.json`. For each package in `dependencies`, either remove it (if it's only used by the addon and not the test-app) or move it to `devDependencies` (if it's actually used by the test-app).
   - For example, `"ember-cli-babel"` and `"ember-cli-htmlbars"` most likely need to move to `devDependencies` because test-app still needs JS and template transpilation.
1. In `test-app/package.json`, add your addon as a `devDependency` of the test-app by name and exact version. Our monorepo setup will see this and link our two packages together. For example, if `addon/package.json` has this:

   ```js
   "name": "ember-page-title",
   "version": "8.0.0",
   ```

   Then you would add this to `test-app/package.json`:

   ```js
   "devDependencies": {
     "ember-page-title": "8.0.0"
   }
   ```

1. In  `test-app/package.json`, change the top-level "name" to "test-app", remove the "ember-addon" section, and remove "ember-addon" from keywords.

1. In  `test-app/package.json`, add the field `"private": true` because this package is not meant to be published on npm.

1. At the top-level of the project, run `pnpm install`.
1. In `test-app/ember-cli-build.js` switch from the dummy app build pipeline to the normal app build pipeline:

   ```diff
   -const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');
   +const EmberApp = require('ember-cli/lib/broccoli/ember-app');
   ...
   -let app = new EmberAddon(defaults, {
   +let app = new EmberApp(defaults, {
   ```

   You may also find other places in `ember-cli-build.js` that refer to files under `tests/dummy`. Update those paths to point directly to their new locations directly inside test-app instead.

1. Search for all uses of the word "dummy" in the test-app. If they're referring to the app name, replace them with "test-app". This includes `modulePrefix` in `test-app/config/environment.js` and `dummy.js` and `dummy.css` in `test-app/app/index.html` and in `test-app/tests/index.html`.
1. Try to boot your test-app and run the tests. Debug as needed to get things passing again.
   ```sh
   cd test-app
   ember s
   ember test
   ```

1. The lint scripts are expected to work the same way as before inside the test-app. However, there's one common issue you may encounter when running the linter if you use `eslint-plugin-n` or `eslint-plugin-node`: 
   ```sh
   error  "@embroider/test-setup" is not published  n/no-unpublished-require
   error  "ember-cli" is not published  n/no-unpublished-require
   ```
   The [lint rule](https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/no-unpublished-require.md) tells that `"@embroider/test-setup"` and `"ember-cli"` are `devDependencies` being imported with `require()`. It's not a problem since the test-app is a private package. To solve the issue, make sure you use an up-to-date version of `eslint-plugin-n` (at least `15.4.0`). If you don't want to update the lint tools right now, you can also deactivate the rule.

1. At this point all tests and lint scripts work the same way as before inside the test-app. But we will also want linting, prettier, etc for the newly-separated addon workspace too.

   > You could create one unified config at the top of the monorepo if you want, but I think it's simpler over the long run to manage each workspace separately. It's nice that the test-app is a totally stock Ember app that can be updated by ember-cli-update -- including all the default linting setup.

   Copy .gitignore, .eslintrc.js, .eslintignore, .prettierrc.js, .prettierignore, and .template-lintrc.js from test-app to addon.

   Edit them down so they only cover the thing the addon workspace has. For example, there's no dummy app or tests inside the addon workspace anymore, so the eslintrc will get simpler.

   Copy eslint, relevant eslint plugins, prettier, ember-template-lint, and npm-run-all from `test-app/package.json` `devDependencies` to `addon/package.json` `devDependencies`.

   Copy the lint-related scripts from `test-app/package.json` to `addon/package.json`.

   Test that `pnpm lint` works inside the `addon` workspace.

1. Remove `test-app/config/ember-cli-update.json` because it still says you're using the **addon** blueprint and next time you run ember-cli-update in `test-app` it uses the **app** blueprint instead.

1. Edit `.github/workflows/ci.yml` to run tests in the right directory. For example:

   ```diff
    - name: Test
      run: pnpm test:ember --launch ${{ matrix.browser }}
   +  working-directory: test-app
   ```

   And make separate linting steps for both workspaces:

   ```diff
   -    - name: Lint
   -      run: pnpm lint
   +    - name: Lint Addon
   +      run: pnpm lint
   +      working-directory: addon
   +    - name: Lint Test App
   +      run: pnpm lint
   +      working-directory: test-app
   ```

1. If you're using volta, move the volta config to the top-level package.json and make both workspaces say:
   ```
   "volta": {
     "extends": "../package.json"
   }
   ```

At this point, you should still have a fully-working V1 Addon, and if you want you can test, review, and merge this work before moving on.

## Part 2 (Optional): Split docs from tests

Many addons have a deployable documentation app. Usually it is the same app as the test suite.

This causes a lot of pain because the test suite needs to support every Ember version your addon supports, and when your docs site is mixed in with your test suite, your docs site _also_ needs to support every Ember version, and that's unnecessarily difficult. Documentation apps deal with lots of typical production app concerns (deployment, styling, server-side rendering) that mean they benefit from using many additional addons, which makes broad version compatibility challenging.

The solution is to split the docs from the test suite. The docs app can pick a _single_ Ember version, and it can stay on older, deprecated patterns as long as you like _without_ impacting your ability to test your addon against the latest Ember canary. When you get test failures on Ember Canary, they will be real failures that impact your users, not irrelevant failures caused by forcing your docs app and all its dependencies to upgrade to Canary.

To split out the docs, you could start by just copying all of `test-app` into a new `docs` directory. Add your new `docs` workspace to the top-level package.json. Then edit both apps down to eliminate documentation and deployment features from `test-app` and eliminate test-suite concerns from `docs`. It's still appropriate for `docs` to have its own tests of course, to prove that the docs pages themselves render correctly.

When the docs app is ready, expand the CI settings to cover linting and testing of the docs app, just like we did when we expanded it to cover linting of both `addon` and `test-app` above.

For a complete example of a PR that splits docs from test-app, see https://github.com/ember-cli/ember-page-title/pull/228.

## Part 3: Prerequisites for V2 addon

In this part, we address potential blockers before we actually switch to V2. This lets you test your changes and make sure they're still working before we move on to V2 format.

1. Make sure your test-app (and docs app if you have one) has `ember-auto-import` >= 2. Once you convert your addon to v2 format, it can only be consumed by apps that have ember-auto-import >= 2. This also means you should plan to make a semver major release to communicate this new requirement to your users.

1. Make sure all the files in the `addon/app` contain _only_ reexport statements. If there's anything that's not a reexport statement, move that code into somewhere in the `addon/addon` directory and reexport it from `addon/app`. This was already best practice, but we're about to enforce it.

1. Make sure all the reexports in `addon/app` follow the default naming convention, such that `addon/app/components/whatever.js` contains only a reexport of `your-addon-name/components/whatever`. If the names don't align, move files around inside `addon/addon` until they do.

1. Make sure your addon has [co-located templates](https://rfcs.emberjs.com/id/0481-component-templates-co-location/). By default, the build tools expect to find the component's `.js` and `.hbs` in the same folder. If your addon used to have an `addon/templates/components` folder, move to co-location. Note that a [codemod](https://www.npmjs.com/package/ember-component-template-colocation-migrator) has been released when co-location has become the recommended structure.

1. Make sure your `addon/index.js` file isn't trying to do anything "interesting". Ideally it contains nothing other than your addon's name.
   - if it was using `app.import()` or `this.import()`, port those usages to `ember-auto-import` instead
   - if you're trying to modify your own source code based on the presence of other packages or based on development vs testing vs production, switch to `@embroider/macros` instead
   - if you have other cases you're not sure what to do with, ask in an issue on this repo, or https://discuss.emberjs.com, or the #dev-embroider channel in the Ember community discord.

## Part 4: Convert addon to v2

In this part we actually convert our addon from v1 to v2 format by reorganizing it and setting up a default toolchain for building and publishing it.

For an example of a complete PR that applies these steps to a real addon, see https://github.com/ember-cli/ember-page-title/pull/229

Now that we've separated the test-app and docs app concerns from the addon, we can focus on reorganizing the addon itself to V2 format.

1. Rename the `addon/addon` directory to `addon/src`.
2. If you have an `addon/addon-test-support` directory, move it to `addon/src/test-support`.
3. In `addon/package.json`, remove any of these that appear in `dependencies`:

   - ember-cli-htmlbars
   - ember-cli-babel
   - ember-auto-import
   - @embroider/macros

   All of these implement standard features of V2 addons that don't need to come as dependencies.

4. `pnpm add @embroider/addon-shim`. This is the only dependency a v2 addon needs (in order to interoperate with ember-cli.
5. We're going to set up a default build pipeline for things like template colocation and decorator support. Install these dev dependencies:

   `pnpm add --save-dev @embroider/addon-dev rollup @rollup/plugin-babel @babel/core @babel/plugin-transform-class-properties @babel/plugin-proposal-decorators`

6. Grab the [example babel config](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/sample-babel.config.json) and save it as `addon/babel.config.json`
   - If you addon requires template transforms in order to publish to a shareable format. Apply transforms using the `babel-plugin-ember-template-compilation`. View how to use this in the [example babel.config.js](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/sample-babel.config.js)
7. Grab the [example rollup config](https://github.com/embroider-build/embroider/blob/main/packages/addon-dev/sample-rollup.config.js) and save it as `addon/rollup.config.js`.
8. Identify your **app reexports**. This is the list of modules from your addon that get reexported by files in the `addon/app` directory.
9. Edit `addon/rollup.config.js`. Customize the `publicEntrypoints` so it includes

- every module that users should be allowed to import from your addon
- every module in the **app reexports** you identified in the previous step

10. Delete the `addon/app` directory. You aren't going to need it anymore.
11. Still editing `addon/rollup.config.js`, customize the `appReexports` to match all your **app reexports** as identified above.
12. If your addon contains `.gjs` files, add `addon.gjs()`  to `addon/rollup.config.js`.
13. Delete your `addon/index.js` file.
14. Create a new `addon/addon-main.js` file (this replaces `addon/index.js`) with this exact content:

```js
const { addonV1Shim } = require('@embroider/addon-shim');
module.exports = addonV1Shim(__dirname);
```

14. In your `addon/.eslintrc.js`, replace "index.js" with "addon-main.js" so that our new file will lint correctly as Node code.
15. In your `addon/package.json`, add these things:
    ```js
    "exports": {
      ".": "./dist/index.js",
      "./*": "./dist/*",
      "./test-support": "./dist/test-support/index.js",
      "./addon-main.js": "./addon-main.js"
    },
    "files": [
      "addon-main.js",
      "dist"
    ],
    "scripts": {
      "build": "rollup --config",
      "prepublishOnly": "rollup --config",
      "start": "rollup --config --watch"
    },
    "ember-addon": {
      "main": "addon-main.js",
      "type": "addon",
      "version": 2
    }
    ```
16. In the `addon` directory, run `pnpm start` to start building the addon.
17. In a separate shell, you should be able to go into the `test-app` directory and run `pnpm start` or `pnpm test` and see your tests passing.
18. when running the `addon` and `test-app` together, the addon will automatically rebuild for changes. if using vite, the new build is automatically picked up by the test-app too. However, if using non-embroider, you need to configure autoImport.watchDependencies. If using embroider-webpack, you need to configure the [broccoli-side-watch](https://www.npmjs.com/package/@embroider/broccoli-side-watch) tool.

When all tests are passing, you have a fully-working V2 addon and you're ready to release it. To publish, you will run `npm publish` in the `addon` directory.
