import { sep } from 'path';
import { Package, AddonPackage } from '@embroider/shared-internals';
import AppDiffer from './app-differ';

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
  readonly relocatedFiles: Map<string, string>;
  readonly isFastbootOnly: Map<string, boolean>;

  constructor(appDiffer: AppDiffer, resolvableExtensions: RegExp, podModulePrefix?: string) {
    let tests: string[] = [];
    let components: string[] = [];
    let helpers: string[] = [];
    let modifiers: string[] = [];
    let otherAppFiles: string[] = [];
    this.perRoute = { children: new Map() };
    for (let relativePath of appDiffer.files.keys()) {
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
        if (/-test\.\w+$/.test(relativePath)) {
          tests.push(relativePath);
        }
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
        this.handleClassicRouteFile(relativePath) ||
        (podModulePrefix !== undefined && this.handlePodsRouteFile(relativePath, podModulePrefix))
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

    let relocatedFiles: Map<string, string> = new Map();
    for (let [relativePath, owningPath] of appDiffer.files) {
      if (owningPath) {
        relocatedFiles.set(relativePath, owningPath);
      }
    }
    this.relocatedFiles = relocatedFiles;
    this.isFastbootOnly = appDiffer.isFastbootOnly;
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

export interface EngineSummary {
  // the engine's own package
  package: Package;
  // the set of active addons in the engine
  addons: Set<AddonPackage>;
  // the parent engine, if any
  parent: EngineSummary | undefined;
  // where the engine's own V2 code comes from
  sourcePath: string;
  // where the engine gets built into, combining its own code with all its
  // addons
  destPath: string;
  // runtime name for the engine's own module namespace
  modulePrefix: string;
  // this is destPath but relative to the app itself
  appRelativePath: string;
}

export interface Engine extends EngineSummary {
  appFiles: AppFiles;
}
