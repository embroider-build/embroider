import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  deprecateOldConfig,
  getFromEmbroiderConfig,
  hasSpecifiedInEmbroiderConfig,
  loadEmbroiderConfig,
  withUserConfig,
} from '../src/embroider-config';
import type { Options as ResolverOptions } from '../src/module-resolver-options';
import { readResolverConfig, writeResolverConfig } from '../src/prebuild-state';

function makeApp(files: Record<string, string>): string {
  let root = mkdtempSync(join(tmpdir(), 'embroider-config-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app' }));
  for (let [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content);
  }
  return root;
}

function resolverOptions(extra: Partial<ResolverOptions> = {}): ResolverOptions {
  return Object.assign({ modulePrefix: 'my-app', staticAppPaths: [] } as unknown as ResolverOptions, extra);
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

describe('options from the config file', () => {
  test('finds top-level and nested options', () => {
    let root = makeApp({
      '.embroiderrc.json': JSON.stringify({ staticInvokables: false, amdCompatibility: { es: [] } }),
    });
    expect(hasSpecifiedInEmbroiderConfig(root, 'staticInvokables')).toBe(true);
    expect(getFromEmbroiderConfig(root, 'staticInvokables')).toBe(false);
    expect(hasSpecifiedInEmbroiderConfig(root, 'amdCompatibility.es')).toBe(true);
    expect(getFromEmbroiderConfig(root, 'amdCompatibility.es')).toEqual([]);
    expect(hasSpecifiedInEmbroiderConfig(root, 'splitAtRoutes')).toBe(false);
    expect(hasSpecifiedInEmbroiderConfig(root, 'amdCompatibility.cjs')).toBe(false);
  });

  test('finds no options when the app has no config', () => {
    let root = makeApp({});
    expect(hasSpecifiedInEmbroiderConfig(root, 'splitAtRoutes')).toBe(false);
    expect(getFromEmbroiderConfig(root, 'splitAtRoutes')).toBeUndefined();
  });

  test('shows the deprecation of the old place once per option', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'] }) });
    let warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      deprecateOldConfig(root, 'splitAtRoutes', 'ember-cli-build');
      deprecateOldConfig(root, 'splitAtRoutes', 'ember-cli-build');
      expect(warn.mock.calls).toEqual([
        [
          'DEPRECATION: The Embroider option "splitAtRoutes" is set in ember-cli-build and in .embroiderrc.json. ' +
            'Embroider uses the value from .embroiderrc.json. Remove "splitAtRoutes" from ember-cli-build.',
        ],
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('withUserConfig', () => {
  test('keeps the resolver options when the app has no config', () => {
    let options = resolverOptions();
    expect(withUserConfig(makeApp({}), options, false)).toBe(options);
  });

  test('sets the user options of an app without a prebuild', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'], staticAppPaths: ['lib'] }) });
    expect(withUserConfig(root, resolverOptions(), false)).toEqual(
      resolverOptions({ splitAtRoutes: ['admin'], staticAppPaths: ['lib'] })
    );
  });

  test('throws for unexpected properties in an app without a prebuild', () => {
    let root = makeApp({
      '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'], staticInvokables: false, other: 1 }),
    });
    expect(() => withUserConfig(root, resolverOptions(), false)).toThrow(
      `Unexpected properties in .embroiderrc.json: staticInvokables, other. Expected only: splitAtRoutes, staticAppPaths.`
    );
  });

  test('puts the config file over the prebuild state', () => {
    let root = makeApp({
      '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'], staticInvokables: false, packageRules: [] }),
    });
    let prebuilt = resolverOptions({
      splitAtRoutes: ['old'],
      staticAppPaths: ['lib'],
      options: { staticInvokables: true, allowUnsafeDynamicComponents: false },
    });
    expect(withUserConfig(root, prebuilt, true)).toEqual(
      resolverOptions({
        splitAtRoutes: ['admin'],
        staticAppPaths: ['lib'],
        options: { staticInvokables: false, allowUnsafeDynamicComponents: false },
      })
    );
    expect(prebuilt.options?.staticInvokables).toBe(true);
  });
});

describe('prebuild state', () => {
  test('reads back the resolver options with their regular expressions', () => {
    let root = makeApp({});
    expect(readResolverConfig(root)).toBeUndefined();

    writeResolverConfig(root, resolverOptions({ splitAtRoutes: ['admin', /^reports/i] }));
    expect(readResolverConfig(root)).toEqual(resolverOptions({ splitAtRoutes: ['admin', /^reports/i] }));
  });
});
