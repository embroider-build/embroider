import { describe, expect, test, afterAll, beforeAll } from 'vitest';

import type { TemplateTransformOptions } from './helpers';
import { Project, templateTests } from './helpers';
import { join } from 'path';

describe('dependency satisfies', () => {
  let project: Project;
  let filename: string;

  beforeAll(() => {
    project = new Project('app');
    project.addDependency('qunit', '2.9.1');
    project.addDependency('foo', '1.1.0-beta.1');
    project.writeSync();
    filename = join(project.baseDir, 'sample.js');
  });

  afterAll(() => {
    project?.dispose();
  });

  templateTests((transform: (code: string, options?: TemplateTransformOptions) => string) => {
    test('in content position', () => {
      let result = transform(`{{macroDependencySatisfies 'qunit' '^2.8.0'}}`, { filename });
      expect(result).toEqual('{{true}}');
    });

    test('in subexpression position', () => {
      let result = transform(`<Foo @a={{macroDependencySatisfies 'qunit' '^2.8.0'}} />`, { filename });
      expect(result).toMatch(/@a=\{\{true\}\}/);
    });

    test('emits false for out-of-range package', () => {
      let result = transform(`{{macroDependencySatisfies 'qunit' '^10.0.0'}}`, { filename });
      expect(result).toEqual('{{false}}');
    });

    test('emits false for missing package', () => {
      let result = transform(`{{macroDependencySatisfies 'not-a-real-dep' '^10.0.0'}}`, { filename });
      expect(result).toEqual('{{false}}');
    });

    test('args length error', () => {
      expect(() => {
        transform(`{{macroDependencySatisfies 'not-a-real-dep'}}`, { filename });
      }).toThrow(/macroDependencySatisfies requires two arguments, you passed 1/);
    });

    test('non literal arg error', () => {
      expect(() => {
        transform(`{{macroDependencySatisfies someDep "*"}}`, { filename });
      }).toThrow(/all arguments to macroDependencySatisfies must be string literals/);
    });

    test('it considers prereleases (otherwise within the range) as allowed', () => {
      let result = transform(`{{macroDependencySatisfies 'foo' '^1.0.0'}}`, { filename });
      expect(result).toEqual('{{true}}');
    });
  });
});
