import type { Project } from 'scenario-tester';
import { baseV2Addon } from '../scenarios';
import merge from 'lodash/merge';

export function sourcemapDemoAddon(): Project {
  let addon = baseV2Addon();
  addon.pkg.name = 'v2-addon';
  addon.pkg.files = ['dist'];
  addon.pkg.exports = {
    './*': './dist/*.js',
    './addon-main.js': './addon-main.js',
    './package.json': './package.json',
  };
  addon.pkg.scripts = {
    build: 'node ./node_modules/rollup/dist/bin/rollup -c ./rollup.config.mjs',
  };

  merge(addon.files, {
    'babel.config.json': `
      {
        "plugins": [
          "@babel/plugin-transform-typescript",
          ["babel-plugin-ember-template-compilation", {
            targetFormat: 'hbs',
          }],
          ["module:decorator-transforms", {
            runtime: { import: 'decorator-transforms/runtime-esm' }
          }]
        ]
      }
    `,
    'rollup.config.mjs': `
      import { babel } from '@rollup/plugin-babel';
      import { Addon } from '@embroider/addon-dev/rollup';

      const addon = new Addon({
        srcDir: 'src',
        destDir: 'dist',
      });

      export default {
        output: addon.output(),

        plugins: [
          addon.publicEntrypoints(['components/**/*.js']),

          addon.appReexports(['components/**/*.js']),

          addon.dependencies(),

          babel({ babelHelpers: 'bundled', extensions: ['.js', '.hbs', '.gjs', '.gts', '.ts'] }),

          addon.gjs(),
          addon.hbs(),

          addon.clean(),
        ],
      };
    `,
    src: {
      components: {
        'addon-gjs-demo.gjs': `import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const addonGjsScopedValue = 'addon-gjs-scoped-value';

export default class AddonGjsDemo extends Component {
  @tracked addonGjsTrackedValue = 'addon-gjs-tracked-value';

  <template>
    <span data-test-addon-gjs>{{addonGjsScopedValue}} {{this.addonGjsTrackedValue}}</span>
  </template>
}
`,
        'addon-gts-demo.gts': `import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface AddonGtsDemoSignature {
  Args: {
    name?: string;
  };
}

const addonGtsScopedValue: string = 'addon-gts-scoped-value';

export default class AddonGtsDemo extends Component<AddonGtsDemoSignature> {
  @tracked addonGtsTrackedValue: string = 'addon-gts-tracked-value';

  <template>
    <span data-test-addon-gts>{{addonGtsScopedValue}} {{@name}} {{this.addonGtsTrackedValue}}</span>
  </template>
}
`,
      },
    },
  });

  addon.linkDependency('@embroider/addon-shim', { baseDir: __dirname });
  addon.linkDependency('@embroider/addon-dev', { baseDir: __dirname });
  addon.linkDependency('babel-plugin-ember-template-compilation', { baseDir: __dirname });
  addon.linkDevDependency('@babel/core', { baseDir: __dirname });
  addon.linkDevDependency('@babel/plugin-transform-typescript', { baseDir: __dirname });
  addon.linkDependency('decorator-transforms', { baseDir: __dirname });
  addon.linkDevDependency('@rollup/plugin-babel', { baseDir: __dirname });
  addon.linkDevDependency('rollup', { baseDir: __dirname });

  return addon;
}
