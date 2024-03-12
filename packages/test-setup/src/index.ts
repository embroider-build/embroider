import type { PipelineOptions } from '@embroider/compat';
import type { PackagerConstructor } from '@embroider/core';
import type { Webpack } from '@embroider/webpack';
import Plugin from 'broccoli-plugin';
import { spawn } from 'child_process';

type EmberWebpackOptions = typeof Webpack extends PackagerConstructor<infer Options> ? Options : never;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ourPeerDeps = require('../package.json').peerDependencies;

const embroiderDevDeps = {
  '@embroider/core': `${ourPeerDeps['@embroider/core']}`,
  '@embroider/webpack': `${ourPeerDeps['@embroider/webpack']}`,
  '@embroider/compat': `${ourPeerDeps['@embroider/compat']}`,
  // Webpack is a peer dependency of `@embroider/webpack`
  webpack: '^5.0.0',
};

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
  let Compat = require(require.resolve('@embroider/compat', {
    paths: [app.project.root],
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  })) as typeof import('@embroider/compat');
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
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

  if (process.env.EMBROIDER_PREBUILD) {
    return Compat.prebuild(app, opts);
  }

  return new BuildWithVite([]);
}

class BuildWithVite extends Plugin {
  build(): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(`npx vite build --outDir ${this.outputPath}`, {
        cwd: process.cwd(),
        shell: true,
        stdio: 'inherit',
        env: { ...process.env },
      });
      child.on('exit', code => (code === 0 ? resolve() : reject(new Error('vite build failed'))));
    });
  }
}

export function embroiderSafe(extension?: object) {
  return extendScenario(
    {
      name: 'embroider-safe',
      npm: {
        devDependencies: embroiderDevDeps,
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
        devDependencies: embroiderDevDeps,
      },
      env: {
        EMBROIDER_TEST_SETUP_OPTIONS: 'optimized',
      },
    },
    extension
  );
}

function extendScenario(scenario: object, extension?: object) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
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
