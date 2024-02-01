import { sep } from 'path';
import type { Package, AddonPackage } from '@embroider/shared-internals';

export interface RouteFiles {
  route?: string;
  template?: string;
  controller?: string;
  children: Map<string, RouteFiles>;
}

export class AppFiles {
  readonly tests: ReadonlyArray<string>;
  readonly components: ReadonlyArray<string>;
  readonly helpers: ReadonlyArray<string>;
  readonly modifiers: ReadonlyArray<string>;
  private perRoute: RouteFiles;
  readonly otherAppFiles: ReadonlyArray<string>;
  readonly isFastbootOnly: Map<string, boolean>;
  readonly fastbootFiles: { [appName: string]: { localFilename: string; shadowedFilename: string | undefined } };

  constructor(
    readonly engine: Engine,
    appFiles: Set<string>,
    fastbootFiles: Set<string>,
    resolvableExtensions: RegExp,
    podModulePrefix?: string
  ) {
    let tests: string[] = [];
    let components: string[] = [];
    let helpers: string[] = [];
    let modifiers: string[] = [];
    let otherAppFiles: string[] = [];
    this.perRoute = { children: new Map() };

    let combinedFiles = new Set<string>();
    let combinedNonFastbootFiles = new Set<string>();
    let isFastbootOnly = new Map<string, boolean>();

    for (let f of appFiles) {
      combinedFiles.add(f);
      combinedNonFastbootFiles.add(f);
    }
    for (let f of fastbootFiles) {
      combinedFiles.add(f);
    }

    for (let addon of engine.addons.keys()) {
      let appJS = addon.meta['app-js'];
      if (appJS) {
        for (let filename of Object.keys(appJS)) {
          filename = filename.replace(/^\.\//, '');
          combinedFiles.add(filename);
          combinedNonFastbootFiles.add(filename);
        }
      }

      let fastbootJS = addon.meta['fastboot-js'];
      if (fastbootJS) {
        for (let filename of Object.keys(fastbootJS)) {
          filename = filename.replace(/^\.\//, '');
          combinedFiles.add(filename);
        }
      }
    }

    for (let relativePath of combinedFiles) {
      isFastbootOnly.set(relativePath, !combinedNonFastbootFiles.has(relativePath));
      relativePath = relativePath.split(sep).join('/');
      if (!resolvableExtensions.test(relativePath)) {
        continue;
      }

      if (/\.d\.ts$/.test(relativePath)) {
        // .d.ts files are technically "*.ts" files but aren't really and we
        // don't want to include them when we crawl through the app.
        continue;
      }

      if (relativePath.startsWith('tests/')) {
        tests.push(relativePath);
        continue;
      }

      if (relativePath.startsWith('components/')) {
        // hbs files are resolvable, but not when they're used via co-location.
        // An hbs file is used via colocation when it's inside the components
        // directory, and also not named "template.hbs" (because that is an
        // older pattern used with pods-like layouts).
        if (!relativePath.endsWith('.hbs') || relativePath.endsWith('/template.hbs')) {
          components.push(relativePath);
        }
        continue;
      }

      if (relativePath.startsWith('templates/components/')) {
        components.push(relativePath);
        continue;
      }

      if (relativePath.startsWith('helpers/')) {
        helpers.push(relativePath);
        continue;
      }

      if (relativePath.startsWith('modifiers/')) {
        modifiers.push(relativePath);
        continue;
      }

      if (
        (podModulePrefix !== undefined && this.handlePodsRouteFile(relativePath, podModulePrefix)) ||
        this.handleClassicRouteFile(relativePath)
      ) {
        continue;
      }

      otherAppFiles.push(relativePath);
    }
    this.tests = tests;
    this.components = components;
    this.helpers = helpers;
    this.modifiers = modifiers;
    this.otherAppFiles = otherAppFiles;
    this.isFastbootOnly = isFastbootOnly;

    // this deliberately only describes the app's fastboot files. Not the full
    // merge from all the addons. This is because they need different handling
    // in the module resolver -- addon fastboot files can always be a
    // fallbackResolve, because if the app happens to define the same name
    // (whether fastboot-specific or just browser) that wins over the addon.
    // Whereas if the app itself defines a fastbot-specific version of a file,
    // that must take precedence over the *normal* resolution, and must be
    // implemented in beforeResolve.
    this.fastbootFiles = Object.fromEntries(
      [...fastbootFiles].map(name => [
        `./${name}`,
        {
          localFilename: `./_fastboot_/${name}`,
          shadowedFilename: appFiles.has(name) ? `./${name}` : undefined,
        },
      ])
    );
  }

  private handleClassicRouteFile(relativePath: string): boolean {
    let [prefix, ...rest] = relativePath.replace(/\.\w{1,3}$/, '').split('/');
    if (!['controllers', 'templates', 'routes'].includes(prefix)) {
      return false;
    }
    let type = prefix.slice(0, -1) as 'controller' | 'template' | 'route';
    let cursor = this.perRoute;
    for (let part of rest) {
      let child = cursor.children.get(part);
      if (child) {
        cursor = child;
      } else {
        let newEntry = { children: new Map() };
        cursor.children.set(part, newEntry);
        cursor = newEntry;
      }
    }
    cursor[type] = relativePath;
    return true;
  }

  private handlePodsRouteFile(relativePath: string, podModulePrefix: string): boolean {
    let parts = relativePath.replace(/\.\w{1,3}$/, '').split('/');
    let type = parts.pop();
    if (!type || !['controller', 'template', 'route'].includes(type)) {
      return false;
    }
    let podParts = podModulePrefix.split('/');
    // The first part of podModulePrefix is the app's package name
    podParts.shift();

    for (let podPart of podParts) {
      if (parts.shift() !== podPart) {
        return false;
      }
    }

    let cursor = this.perRoute;
    for (let part of parts) {
      let child = cursor.children.get(part);
      if (child) {
        cursor = child;
      } else {
        let newEntry = { children: new Map() };
        cursor.children.set(part, newEntry);
        cursor = newEntry;
      }
    }
    cursor[type as 'controller' | 'template' | 'route'] = relativePath;
    return true;
  }

  get routeFiles(): Readonly<RouteFiles> {
    return this.perRoute;
  }
}

export interface Engine {
  // the engine's own package
  package: Package;
  // the set of active addons in the engine. For each one we keep track of a file that can resolve the addon, because we'll need that later.
  addons: Map<AddonPackage, string>;
  // is this the top-level engine?
  isApp: boolean;
  // runtime name for the engine's own module namespace
  modulePrefix: string;
  // TODO: remove this after we remove the stage2 entrypoint
  appRelativePath: string;
}
