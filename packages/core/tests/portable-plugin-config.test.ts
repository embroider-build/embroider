import { PortablePluginConfig } from '../src/portable-plugin-config';

function run(moduleCode: string): any {
  let module = { exports: {} } as any;
  eval(moduleCode);
  return module.exports;
}

describe('portable-plugin-config', () => {
  test('explicit serialization', () => {
    let config = new PortablePluginConfig({
      myFunc: () => 42,
    });
    expect(run(config.serialize()).myFunc()).toEqual(42);
  });

  test('survives JSON.stringify', () => {
    let config = new PortablePluginConfig({
      myFunc: () => 42,
    });
    let output = PortablePluginConfig.load(JSON.parse(JSON.stringify(config.portable)));
    expect(output.myFunc()).toEqual(42);
  });
});
