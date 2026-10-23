import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { withEmbroiderConfig } from '../src/options';

function makeApp(config?: object): string {
  let root = mkdtempSync(join(tmpdir(), 'embroider-config-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app' }));
  if (config) {
    writeFileSync(join(root, '.embroiderrc.json'), JSON.stringify(config));
  }
  return root;
}

describe('withEmbroiderConfig', () => {
  test('keeps the ember-cli-build options when the app has no config', () => {
    let options = { splitAtRoutes: ['admin'] };
    expect(withEmbroiderConfig(makeApp(), options)).toBe(options);
  });

  test('adds the options of the config file', () => {
    let root = makeApp({ splitAtRoutes: ['admin'] });
    expect(withEmbroiderConfig(root, { staticAppPaths: ['lib'] })).toEqual({
      splitAtRoutes: ['admin'],
      staticAppPaths: ['lib'],
    });
    expect(withEmbroiderConfig(root, undefined)).toEqual({ splitAtRoutes: ['admin'] });
  });

  test('throws when ember-cli-build and the config file set the same option', () => {
    let root = makeApp({ splitAtRoutes: ['admin'], staticAppPaths: ['lib'], staticInvokables: true });
    expect(() => withEmbroiderConfig(root, { splitAtRoutes: ['other'], staticAppPaths: ['lib'] })).toThrow(
      `These Embroider options are set in ember-cli-build and in .embroiderrc.json: splitAtRoutes, staticAppPaths. Set each option in one place only.`
    );
  });

  test('ignores ember-cli-build options that are undefined', () => {
    let root = makeApp({ splitAtRoutes: ['admin'] });
    expect(withEmbroiderConfig(root, { splitAtRoutes: undefined })).toEqual({ splitAtRoutes: ['admin'] });
  });
});
