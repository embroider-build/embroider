import TemplateCompiler, { rehydrate } from '../src/template-compiler';
import { emberTemplateCompilerPath } from '@embroider/test-support';

const compilerPath = emberTemplateCompilerPath();

function run(moduleCode: string): any {
  let module = { exports: {} } as any;
  eval(moduleCode);
  return module.exports;
}

describe('portable-template-config', () => {
  let compiler: TemplateCompiler;
  beforeEach(() => {
    compiler = new TemplateCompiler({
      compilerPath,
      EmberENV: {},
      plugins: {
        ast: [
          function() {
            return 'hello world';
          },
        ],
      },
    });
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
