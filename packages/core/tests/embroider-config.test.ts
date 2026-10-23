import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadEmbroiderConfig, resolverOptionsFromEmbroiderConfig } from '../src/embroider-config';

function makeApp(files: Record<string, string>): string {
  let root = mkdtempSync(join(tmpdir(), 'embroider-config-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app' }));
  for (let [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content);
  }
  return root;
}

describe('loadEmbroiderConfig', () => {
  test('returns undefined when the app has no config', () => {
    let root = makeApp({});
    expect(loadEmbroiderConfig(root)).toBeUndefined();
  });

  test('reads the "embroider" key of package.json', () => {
    let root = makeApp({
      'package.json': JSON.stringify({ name: 'my-app', embroider: { splitAtRoutes: ['admin'] } }),
    });
    expect(loadEmbroiderConfig(root)).toEqual({
      filepath: join(root, 'package.json'),
      config: { splitAtRoutes: ['admin'] },
    });
  });

  test('reads .embroiderrc.json', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ staticAppPaths: ['lib'] }) });
    expect(loadEmbroiderConfig(root)?.config).toEqual({ staticAppPaths: ['lib'] });
  });

  test('reads embroider.config.cjs', () => {
    let root = makeApp({ 'embroider.config.cjs': `module.exports = { splitAtRoutes: [/^admin/] };` });
    expect(loadEmbroiderConfig(root)?.config).toEqual({ splitAtRoutes: [/^admin/] });
  });

  test('does not search the parent directories of the app', () => {
    let parent = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'] }) });
    let root = join(parent, 'app');
    mkdirSync(root);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app' }));
    expect(loadEmbroiderConfig(root)).toBeUndefined();
  });

  test('throws when the config is not an object', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify(['admin']) });
    expect(() => loadEmbroiderConfig(root)).toThrow(/must be an object of options/);
  });
});

describe('resolverOptionsFromEmbroiderConfig', () => {
  test('returns the route splitting options', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'], staticAppPaths: ['lib'] }) });
    expect(resolverOptionsFromEmbroiderConfig(root)).toEqual({ splitAtRoutes: ['admin'], staticAppPaths: ['lib'] });
  });

  test('throws for an option that needs ember-cli-build', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ staticInvokables: false }) });
    expect(() => resolverOptionsFromEmbroiderConfig(root)).toThrow(
      `.embroiderrc.json sets the Embroider option "staticInvokables". Apps without an ember-cli-build file can set only these options: splitAtRoutes, staticAppPaths.`
    );
  });
});
