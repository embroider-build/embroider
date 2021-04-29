import type { PipelineOptions } from '@embroider/compat';
import type { Packager } from '@embroider/core';
import type { Webpack } from '@embroider/webpack';

type EmberWebpackOptions = typeof Webpack extends Packager<infer Options> ? Options : never;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const currentEmbroiderVersion = require('../package.json').version;

/*
  Use this instead of `app.toTree()` in your ember-cli-build.js:

    return maybeEmbroider(app);

*/
export function maybeEmbroider(app: any, opts: PipelineOptions<EmberWebpackOptions> = {}) {
  if (!shouldUseEmbroider(app)) {
    return app.toTree(opts?.extraPublicTrees);
  }

  // we're using `require` here on purpose because
  //  - we don't want to load any of these things until they're actually needed;
  //  - we can't use `await import()` because this function needs to be synchronous to go inside ember-cli-build.js
  /* eslint-disable @typescript-eslint/no-require-imports */
  let resolve = require('resolve') as typeof import('resolve');
  let { Webpack } = require(resolve.sync('@embroider/webpack', {
    basedir: app.project.root,
  })) as typeof import('@embroider/webpack');
  let Compat = require(resolve.sync('@embroider/compat', {
    basedir: app.project.root,
  })) as typeof import('@embroider/compat');
  let mergeWith = require('lodash/mergeWith') as typeof import('lodash/mergeWith');
  /* eslint-enable @typescript-eslint/no-require-imports */

  if (process.env.EMBROIDER_TEST_SETUP_OPTIONS) {
    let scenario = Compat.recommendedOptions[process.env.EMBROIDER_TEST_SETUP_OPTIONS];
    if (scenario) {
      opts = mergeWith({}, scenario, opts, appendArrays);
      console.log(`Successfully applied EMBROIDER_TEST_SETUP_OPTIONS=${process.env.EMBROIDER_TEST_SETUP_OPTIONS}`);
    } else {
      throw new Error(`No such scenario EMBROIDER_TEST_SETUP_OPTIONS=${process.env.EMBROIDER_TEST_SETUP_OPTIONS}`);
    }
  }

  return Compat.compatBuild(app, Webpack, opts);
}

export function embroiderSafe(extension?: object) {
  return extendScenario(
    {
      name: 'embroider-safe',
      npm: {
        devDependencies: {
          '@embroider/core': currentEmbroiderVersion,
          '@embroider/webpack': currentEmbroiderVersion,
          '@embroider/compat': currentEmbroiderVersion,

          // Webpack is a peer dependency of `@embroider/webpack`
          webpack: '^5.0.0',
        },
      },
      env: {
        EMBROIDER_TEST_SETUP_OPTIONS: 'safe',
      },
    },
    extension
  );
}

export function embroiderOptimized(extension?: object) {
  return extendScenario(
    {
      name: 'embroider-optimized',
      npm: {
        devDependencies: {
          '@embroider/core': currentEmbroiderVersion,
          '@embroider/webpack': currentEmbroiderVersion,
          '@embroider/compat': currentEmbroiderVersion,

          // Webpack is a peer dependency of `@embroider/webpack`
          webpack: '^5.0.0',
        },
      },
      env: {
        EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
      },
    },
    extension
  );
}

function extendScenario(scenario: object, extension?: object) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let mergeWith = require('lodash/mergeWith') as typeof import('lodash/mergeWith');
  return mergeWith(scenario, extension, appendArrays);
}

function appendArrays(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function shouldUseEmbroider(app: any): boolean {
  if (process.env.EMBROIDER_TEST_SETUP_FORCE === 'classic') {
    return false;
  }
  if (process.env.EMBROIDER_TEST_SETUP_FORCE === 'embroider') {
    return true;
  }
  return '@embroider/core' in app.dependencies();
}
