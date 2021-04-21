# Embroider Onboarding CLI

This goal of the Embroider Onboarding CLI is to handle three use cases the Ember community is expected to encounter moving from the existing build system (classic) to Embroider. The first case is to verify your app is ready to begin the migration process. We call this `preflighting` and is used to ensure that your app is on a solid baseline to begin the migration process (see below for more details about what is checked during this step). The next case is the actual `migration` process. This is largely applying a set of small code changes to your 'ember-cli-build.js' to get it to use Embroider. Once these two commands have run successfully your app would be converted to Embroider running in "safe mode" (or no static optimizations enabled). The last case is to start enabling optimizations that Embroider provides. These optimizations enable features such as treeshaking which can help reduce your overall asset sizes and related page load times. Due to the dynamic behavior of the classic system some of these optimizations cannot be safely turned on without some app or addon modifications. This is where the `audit` command is useful. It attempts to highlight areas of your code that will need to be changed in order to enable these optimizations.

## OPEN QUESTIONS
  - name of the CLI: is @embroider/cli confusing with ember-cli?
  - What else can we do during the preflight?
  - Can the audit tool be used with passing optimization flags?

## Getting Started

The first step is to run:

```
npx @embroider/cli preflight
```

and fix all issues reported here before continuing. If you see "Your app has passed Embroider preflighting" you are ready to continue. It is also generally recommended to commit each fix individually to your VCS and verify your tests continue to pass after each item.

The next step is to run:

```
npx @embroider/cli migrate
```

This command will modify some files in your project while also installing some dependencies. After running this command follow the output instructions on how to validate that your app is running on Embroider. At this point it is recommended to keep your app at this point for a little while to fully validate that there is no problems. We have seen success at one week before trying to enable optimizations.

The next step is to run:

```
npx @embroider/cli audit
```

TBD...s


## Command Information

### Preflight

The goal of the preflight command is to give users an easy yes or no answer to the question: can I start migrating to Embroider? As an example, we can check if the project is on the minimal set of package versions of known "fixed" addons along with other things*. While this check is intended to give you some confidence that you can being the migration process it cannot cover all failure scenarios you may encounter.

```
npx @embroider/cli preflight
npx @embroider/cli preflight --additional-pkgs internal-addons.json
```

#### Preflight Checks Preformed:

- Minimum package versions of "fixed" addons
  - ember-cli-fastboot to 2.2.3
  - ember-math-helpers to 2.14.0
  - @ember/test-waiters
  - ember-inflector
  - ember-cli-mirage
  - ember-fn-helper-polyfill
  - ember-classic-decorator
  - ember-holy-futuristic-template-namespacing-batman
  - glimmer-vm
  - more will be added...

- Source to source transpilation of HBS files

- Check addon.scss engine
  - Error: addon.scss:6:10: `account` was not found in any of the following locations:

- Check valid index/test.html
  - could not find app javascript in index.html
  - check if using unsupported fingerprinting
  - check if using unsupported outputPaths

- Cannot resolve x in y (this might be covered in audit tool already)
  - re-exports of non-existent modules

### Migrate

The migrate command is purely to codemod the steps to get your app onto Embroider. This includes a small change to your 'ember-cli-build.js' and installs the embroider packages. NOTE: This command should only be run if the above preflight command is successful.

```
npx @embroider/cli migrate
npx @embroider/cli migrate --additional-steps
```

#### Files changed:

- ember-cli-build.js
- package.json
- router.js (should we prep the app for route splitting?)

### Audit (TBDs)

```
npx @embroider/cli audit
```