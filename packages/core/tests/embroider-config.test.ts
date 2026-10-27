import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadEmbroiderConfig, withEmbroiderConfig, withUserConfig } from '../src/embroider-config';
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

describe('withEmbroiderConfig', () => {
  test('keeps the ember-cli-build options when the app has no config', () => {
    let options = { splitAtRoutes: ['admin'] };
    expect(withEmbroiderConfig(makeApp({}), options)).toBe(options);
  });

  test('adds the options of the config file', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'] }) });
    expect(withEmbroiderConfig(root, { staticAppPaths: ['lib'] })).toEqual({
      splitAtRoutes: ['admin'],
      staticAppPaths: ['lib'],
    });
    expect(withEmbroiderConfig(root, undefined)).toEqual({ splitAtRoutes: ['admin'] });
  });

  test('throws when ember-cli-build and the config file set the same option', () => {
    let root = makeApp({
      '.embroiderrc.json': JSON.stringify({
        splitAtRoutes: ['admin'],
        staticAppPaths: ['lib'],
        staticInvokables: true,
      }),
    });
    expect(() => withEmbroiderConfig(root, { splitAtRoutes: ['other'], staticAppPaths: ['lib'] })).toThrow(
      `These Embroider options are set in ember-cli-build and in .embroiderrc.json: splitAtRoutes, staticAppPaths. Set each option in one place only.`
    );
  });

  test('ignores ember-cli-build options that are undefined', () => {
    let root = makeApp({ '.embroiderrc.json': JSON.stringify({ splitAtRoutes: ['admin'] }) });
    expect(withEmbroiderConfig(root, { splitAtRoutes: undefined })).toEqual({ splitAtRoutes: ['admin'] });
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
