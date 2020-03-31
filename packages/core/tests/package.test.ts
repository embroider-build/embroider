import Package from '../src/package';
import PackageCache from '../src/package-cache';
import tmp from 'tmp';
import path from 'path';
import fixturify from 'fixturify';
import { Project } from '@embroider/test-support';

tmp.setGracefulCleanup();

describe('package', () => {
  test('it respects BROCCOLI_ENABLED_MEMOIZE for mayRebuild method', () => {
    let { name: tmpLocation } = tmp.dirSync();
    let projectJSON = {
      'package.json': JSON.stringify({
        name: 'foobar-web',
      }),
    };

    fixturify.writeSync(tmpLocation, projectJSON);

    let packageCache = new PackageCache();
    let packageInstance = new Package(tmpLocation, packageCache);

    let originalProcessValue = process.env['BROCCOLI_ENABLED_MEMOIZE'];
    process.env['BROCCOLI_ENABLED_MEMOIZE'] = 'true';

    expect(packageInstance.mayRebuild).toBe(true);

    process.env['BROCCOLI_ENABLED_MEMOIZE'] = 'false';
    expect(packageInstance.mayRebuild).toBe(false);

    delete process.env['BROCCOLI_ENABLED_MEMOIZE'];
    expect(packageInstance.mayRebuild).toBe(false);

    process.env['BROCCOLI_ENABLED_MEMOIZE'] = originalProcessValue;
  });

  test('ordering without before/after', () => {
    let { name: tmpLocation } = tmp.dirSync();
    let app = Project.emberNew();
    app.addAddon('foo', '', '1.0.0');
    app.addAddon('bar', '', '1.0.0');
    app.addAddon('qux', '', '1.0.0');

    app.addDevAddon('foo', '', '2.0.0');
    app.addDevAddon('bar', '', '2.0.0');
    app.addDevAddon('qux', '', '2.0.0');

    app.addDevAddon('a', '', '2.0.0');
    app.addDevAddon('b', '', '2.0.0');
    app.addDevAddon('c', '', '2.0.0');

    app.writeSync(tmpLocation);

    let packageCache = new PackageCache();
    let packageInstance = new Package(path.join(tmpLocation, app.name), packageCache, true);
    expect(packageInstance.dependencies.map(a => ({ name: a.name, version: a.version }))).toEqual([
      { name: 'a', version: '2.0.0' },
      { name: 'b', version: '2.0.0' },
      { name: 'c', version: '2.0.0' },
      { name: '@embroider/compat', version: '0.13.0' },
      { name: '@embroider/core', version: '0.13.0' },
      { name: '@embroider/webpack', version: '0.13.0' },
      { name: '@glimmer/component', version: '1.0.0' },
      { name: 'bar', version: '1.0.0' },
      { name: 'ember-cli', version: '3.15.1' },
      { name: 'ember-cli-babel', version: '7.13.2' },
      { name: 'ember-cli-htmlbars', version: '4.2.2' },
      { name: 'ember-resolver', version: '7.0.0' },
      { name: 'ember-source', version: '3.15.0' },
      { name: 'foo', version: '1.0.0' },
      { name: 'loader.js', version: '4.7.0' },
      { name: 'qux', version: '1.0.0' },
    ]);
  });

  test('ordering with before specified', function() {
    let { name: tmpLocation } = tmp.dirSync();
    let app = Project.emberNew();

    app.addAddon('foo', '', '1.0.0');
    app.addAddon('bar', '', '1.0.0');
    let addon = app.addAddon('qux', '', '1.0.0');
    addon.pkg['ember-addon'].before = 'foo';

    app.writeSync(tmpLocation);

    let packageCache = new PackageCache();
    let packageInstance = new Package(path.join(tmpLocation, app.name), packageCache, true);

    expect(packageInstance.dependencies.map(a => a.name)).toEqual([
      '@embroider/compat',
      '@embroider/core',
      '@embroider/webpack',
      '@glimmer/component',
      'bar',
      'ember-cli',
      'ember-cli-babel',
      'ember-cli-htmlbars',
      'ember-resolver',
      'ember-source',
      'qux',
      'loader.js',
      'foo',
    ]);
  });

  test('ordering with after specified', function() {
    let { name: tmpLocation } = tmp.dirSync();
    let app = Project.emberNew();

    app.addAddon('foo', '', '1.0.0');
    app.addAddon('bar', '', '1.0.0');
    let addon = app.addAddon('qux', '', '1.0.0');
    addon.pkg['ember-addon'].after = 'foo';

    app.writeSync(tmpLocation);

    let packageCache = new PackageCache();
    let packageInstance = new Package(path.join(tmpLocation, app.name), packageCache, true);
    expect(packageInstance.dependencies.map(a => a.name)).toEqual([
      '@embroider/compat',
      '@embroider/core',
      '@embroider/webpack',
      '@glimmer/component',
      'bar',
      'ember-cli',
      'ember-cli-babel',
      'ember-cli-htmlbars',
      'ember-resolver',
      'ember-source',
      'foo',
      'loader.js',
      'qux',
    ]);
  });

  test('ordering always matches package.json name (index.js name is ignored)', function() {
    let { name: tmpLocation } = tmp.dirSync();
    let app = Project.emberNew();

    app.addAddon('lol', 'module.exports = { name: "foo" };', '1.0.0');
    let addon = app.addAddon('qux', '', '1.0.0');
    addon.pkg['ember-addon'].after = 'foo';

    app.writeSync(tmpLocation);

    let packageCache = new PackageCache();
    let packageInstance = new Package(path.join(tmpLocation, app.name), packageCache, true);

    expect(packageInstance.dependencies.map(a => a.name)).toEqual([
      '@embroider/compat',
      '@embroider/core',
      '@embroider/webpack',
      '@glimmer/component',
      'ember-cli',
      'ember-cli-babel',
      'ember-cli-htmlbars',
      'ember-resolver',
      'ember-source',
      'foo',
      'loader.js',
      'qux',
    ]);
  });
});
