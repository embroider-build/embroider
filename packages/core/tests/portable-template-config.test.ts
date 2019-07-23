import TemplateCompiler, { rehydrate } from '../src/template-compiler';
import { emberTemplateCompilerPath } from '@embroider/test-support';
import { Resolver } from '../src';

const compilerPath = emberTemplateCompilerPath();

function run(moduleCode: string): any {
  let module = { exports: {} } as any;
  eval(moduleCode);
  return module.exports;
}

export function fakeResolver() {
  return new FakeResolver();
}

class FakeResolver {
  _parallelBabel = {
    requireFile: __filename,
    buildUsing: 'fakeResolver',
  };
}

describe('portable-template-config', () => {
  let compiler: TemplateCompiler;
  beforeEach(() => {
    let resolver = new FakeResolver();
    compiler = new TemplateCompiler({
      compilerPath,
      EmberENV: {},
      resolver: (resolver as unknown) as Resolver,
      plugins: {
        ast: [
          function() {
            return 'hello world';
          },
        ],
      },
    });
    // This adds circularity to the template compiler's params. It doesn't add
    // circularity to the portableParams because FakeResolver knows how to
    // serialize itself via _parallelBabel.
    (resolver as any).compiler = compiler;
  });

  test('passthrough', () => {
    expect(rehydrate(compiler)).toBe(compiler);
  });

  test('explicit serialization', () => {
    let output = run(compiler.serialize());
    expect(output).toHaveProperty('compile');
    expect(output.params.plugins.ast[0]()).toEqual('hello world');
  });

  test('survives JSON.stringify', () => {
    let output = rehydrate(JSON.parse(JSON.stringify(compiler)));
    expect(output).toHaveProperty('compile');
    expect((output as any).params.plugins.ast[0]()).toEqual('hello world');
  });

  test('survives Object.assign', () => {
    let output = rehydrate(Object.assign({}, compiler));
    expect(output).toHaveProperty('compile');
    expect((output as any).params.plugins.ast[0]()).toEqual('hello world');
  });
});
