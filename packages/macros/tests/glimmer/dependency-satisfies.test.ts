import { templateTests } from './helpers';

describe('dependency satisfies', () => {
  templateTests(transform => {
    test('in content position', () => {
      let result = transform(`{{macroDependencySatisfies 'qunit' '^2.8.0'}}`);
      expect(result).toEqual('{{true}}');
    });

    test('in subexpression position', () => {
      let result = transform(`<Foo @a={{macroDependencySatisfies 'qunit' '^2.8.0'}} />`);
      expect(result).toMatch(/@a=\{\{true\}\}/);
    });

    test('emits false for out-of-range package', () => {
      let result = transform(`{{macroDependencySatisfies 'qunit' '^10.0.0'}}`);
      expect(result).toEqual('{{false}}');
    });

    test('emits false for missing package', () => {
      let result = transform(`{{macroDependencySatisfies 'not-a-real-dep' '^10.0.0'}}`);
      expect(result).toEqual('{{false}}');
    });

    test('args length error', () => {
      expect(() => {
        transform(`{{macroDependencySatisfies 'not-a-real-dep'}}`);
      }).toThrow(/macroDependencySatisfies requires two arguments, you passed 1/);
    });

    test('non literal arg error', () => {
      expect(() => {
        transform(`{{macroDependencySatisfies someDep "*"}}`);
      }).toThrow(/all arguments to macroDependencySatisfies must be string literals/);
    });
  });
});
