import { allBabelVersions } from '@embroider/test-support';
import { join } from 'path';
import tmp from 'tmp';
import { writeFileSync } from 'fs';
import { writeJSONSync } from 'fs-extra';
import { AppMeta } from '../src';

tmp.setGracefulCleanup();

describe('template-colocation-plugin', () => {
  let filename: string;
  allBabelVersions({
    babelConfig() {
      return {
        filename,
        plugins: [[join(__dirname, '../src/template-colocation-plugin.js')]],
      };
    },
    createTests(transform) {
      let removeCallback: tmp.DirResult['removeCallback'];

      function makeColocatedTemplate() {
        writeFileSync(filename.replace(/\.js$/, '.hbs'), 'this is the template', 'utf8');
      }

      beforeEach(function() {
        let name;
        ({ name, removeCallback } = tmp.dirSync());
        filename = join(name, 'sample.js');
        writeJSONSync(join(name, 'package.json'), {
          name: 'sample-package',
          keywords: ['ember-addon'],
          'ember-addon': {
            version: 2,
            type: 'app',
            'auto-upgraded': true,
          } as AppMeta,
        });
      });

      afterEach(function() {
        removeCallback();
      });

      test('anonymous class declaration', () => {
        makeColocatedTemplate();
        let code = transform(`export default class extends Component {}`);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default Ember._setComponentTemplate\(TEMPLATE, class extends Component \{\}/);
      });

      test('named class declaration', () => {
        makeColocatedTemplate();
        let code = transform(`export default class Foo extends Component {}`);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default class Foo extends Component \{\}/);
        expect(code).toMatch(/Ember._setComponentTemplate\(TEMPLATE, Foo\)/);
      });

      test('anonymous function declaration', () => {
        makeColocatedTemplate();
        let code = transform(`export default function(){ return 1; }`);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(
          /export default Ember._setComponentTemplate\(TEMPLATE, function\s*\(\)\s*\{\s*return 1;\s*\}\)/
        );
      });

      test('named function declaration', () => {
        makeColocatedTemplate();
        let code = transform(`export default function x(){ return 1; }`);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default function x\s*\(\)\s*\{\s*return 1;\s*\}/);
        expect(code).toMatch(/Ember._setComponentTemplate\(TEMPLATE, x\)/);
      });

      test('non-class-syntax default export', () => {
        makeColocatedTemplate();
        let code = transform(`
          import Component from '@glimmer/component';
          class Foo extends Component {}
          export default Foo;
        `);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default Ember._setComponentTemplate\(TEMPLATE, Foo\)/);
      });

      test('non-class-syntax as default export', () => {
        makeColocatedTemplate();
        let code = transform(`
          import Component from '@glimmer/component';
          class Foo extends Component {}
          export { Foo as default };
        `);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export { Foo as default }/);
        expect(code).toMatch(/Ember._setComponentTemplate\(TEMPLATE, Foo\)/);
      });

      test('default reexport', () => {
        makeColocatedTemplate();
        let code = transform(`
          export { default } from 'elsewhere';
        `);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/import COMPONENT from ['"]elsewhere['"];/);
        expect(code).toMatch(/Ember._setComponentTemplate\(TEMPLATE, COMPONENT\)/);
        expect(code).toMatch(/export \{ default \} from 'elsewhere'/);
      });

      test('named reexport', () => {
        makeColocatedTemplate();
        let code = transform(`
          export { thing as default } from 'elsewhere';
        `);
        expect(code).toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/import { thing as COMPONENT } from ['"]elsewhere['"];/);
        expect(code).toMatch(/Ember._setComponentTemplate\(TEMPLATE, COMPONENT\)/);
        expect(code).toMatch(/export { thing as default } from ["']elsewhere["']/);
      });

      test('no colocated template is present', () => {
        let code = transform(`export default class extends Component {}`);
        expect(code).not.toMatch(/import TEMPLATE from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default class extends Component \{\}/);
      });

      test('avoids name collision', () => {
        makeColocatedTemplate();
        let code = transform(`
          const TEMPLATE = 'unrelated stuff';
          export default class extends Component {}
        `);
        expect(code).toMatch(/import TEMPLATE0 from ['"]\.\/sample.hbs['"];/);
        expect(code).toMatch(/export default Ember._setComponentTemplate\(TEMPLATE0, class extends Component \{\}/);
      });
    },
  });
});
