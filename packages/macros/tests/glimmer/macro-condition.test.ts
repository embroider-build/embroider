import { Project } from 'scenario-tester';
import { join } from 'path';
import type { TemplateTransformOptions } from './helpers';
import { templateTests } from './helpers';

describe(`macroCondition`, function () {
  let project: Project;

  afterEach(() => {
    project?.dispose();
  });

  templateTests(function (transform: (code: string, opts?: TemplateTransformOptions) => string) {
    test('leaves regular if-block untouched', function () {
      let code = transform(`{{#if this.error}}red{{else}}blue{{/if}}`);
      expect(code).toEqual(`{{#if this.error}}red{{else}}blue{{/if}}`);
    });

    test('macroCondition in content position when true', function () {
      let code = transform(`{{#if (macroCondition true)}}red{{else}}blue{{/if}}`);
      expect(code).toMatch(/red/);
      expect(code).not.toMatch(/blue/);
    });

    test('macroCondition in content position when false', function () {
      let code = transform(`{{#if (macroCondition false)}}red{{else}}blue{{/if}}`);
      expect(code).not.toMatch(/red/);
      expect(code).toMatch(/blue/);
    });

    test('macroCondition in content position when false with no alternate', function () {
      let code = transform(`{{#if (macroCondition false)}}red{{/if}}`);
      expect(code).toEqual('');
    });

    test('macroCondition in subexpression position when true', function () {
      let code = transform(`{{my-assertion (if (macroCondition true) 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ['"]red['"]\}\}/);
    });

    test('macroCondition inside string', function () {
      let code = transform(`<div class="target {{if (macroCondition true) 'red' 'blue' }}"></div>`);
      expect(code).toMatch(/class="target \{\{['"]red['"]\}\}"/);
    });

    test('macroCondition inside string with subexpressions', function () {
      let code = transform(`<div class="target {{if (macroCondition true) (if this.error "red") }}"></div>`);
      expect(code).toMatch(/class="target \{\{if this.error ['"]red['"]\}\}"/);
    });

    test('leaves regular if-subexpression untouched', function () {
      let code = transform(`{{my-assertion (if this.error "red" "blue")}}`);
      expect(code).toEqual(`{{my-assertion (if this.error "red" "blue")}}`);
    });

    test('macroCondition in subexpression position when false', function () {
      let code = transform(`{{my-assertion (if (macroCondition false) 'red' 'blue') }}`);
      expect(code).toMatch(/\{\{my-assertion ['"]blue['"]\}\}/);
    });

    test('macroCondition in subexpression position when false with no alternate', function () {
      let code = transform(`{{my-assertion (if (macroCondition false) 'red') }}`);
      expect(code).toMatch(/\{\{my-assertion undefined\}\}/);
    });

    test('macroCondition composes with other macros, true case', function () {
      project = new Project('app');
      project.addDependency('ember-source', '3.1.2');
      project.writeSync();
      let code = transform(
        `{{my-assertion (if (macroCondition (macroDependencySatisfies 'ember-source' '3.x')) 'red' 'blue') }}`,
        { filename: join(project.baseDir, 'sample.js') }
      );
      expect(code).toMatch(/\{\{my-assertion ["']red["']\}\}/);
    });

    test('macroCondition composes with other macros, false case', function () {
      project = new Project('app');
      project.addDependency('ember-source', '3.1.2');
      project.writeSync();
      let code = transform(
        `{{my-assertion (if (macroCondition (macroDependencySatisfies 'ember-source' '10.x')) 'red' 'blue') }}`,
        { filename: join(project.baseDir, 'sample.js') }
      );
      expect(code).toMatch(/\{\{my-assertion ["']blue["']\}\}/);
    });

    test('macroCondition composes with self', function () {
      let code = transform(
        `{{my-assertion (if (macroCondition true) (if (macroCondition false) 'green' 'red') 'blue') }}`
      );
      expect(code).toMatch(/\{\{my-assertion ["']red["']\}\}/);
    });

    test('macroCondition in modifier position when true', function () {
      let code = transform(`<button {{(if (macroCondition true) on) "click" this.something}}>Submit</button>`);
      expect(code).toMatch('<button {{on "click" this.something}}>Submit</button>');
    });

    test('macroCondition in modifier position when false', function () {
      let code = transform(`<button {{(if (macroCondition false) off on) "click" this.something}}>Submit</button>`);
      expect(code).toMatch('<button {{on "click" this.something}}>Submit</button>');
    });

    test('macroCondition in modifier position when false with no alternate', function () {
      let code = transform(`<button {{(if (macroCondition false) on) "click" this.something}}>Submit</button>`);
      expect(code).toMatch('<button>Submit</button>');
    });
  });
});
