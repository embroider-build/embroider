import { sep } from 'path';
import Package, { V2AddonPackage } from './package';

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
  private perRoute: RouteFiles;
  readonly otherAppFiles: ReadonlyArray<string>;
  readonly relocatedFiles: Map<string, string>;

  constructor(relativePaths: Map<string, string | null>, resolvableExtensions: RegExp) {
    let tests: string[] = [];
    let components: string[] = [];
    let helpers: string[] = [];
    let otherAppFiles: string[] = [];
    this.perRoute = { children: new Map() };
    for (let relativePath of relativePaths.keys()) {
      relativePath = relativePath.split(sep).join('/');
      if (!resolvableExtensions.test(relativePath)) {
        continue;
      }

      if (relativePath.startsWith('tests/')) {
        if (/-test\.\w+$/.test(relativePath)) {
          tests.push(relativePath);
        }
        continue;
      }

      // hbs files are resolvable, but not when they're inside the components
      // directory (where they are used for colocation only)
      if (relativePath.startsWith('components/') && !relativePath.endsWith('.hbs')) {
        components.push(relativePath);
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

      if (this.handleRouteFile(relativePath)) {
        continue;
      }

      otherAppFiles.push(relativePath);
    }
    this.tests = tests;
    this.components = components;
    this.helpers = helpers;
    this.otherAppFiles = otherAppFiles;

    let relocatedFiles: Map<string, string> = new Map();
    for (let [relativePath, owningPath] of relativePaths) {
      if (owningPath) {
        relocatedFiles.set(relativePath, owningPath);
      }
    }
    this.relocatedFiles = relocatedFiles;
  }

  private handleRouteFile(relativePath: string): boolean {
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

  get routeFiles(): Readonly<RouteFiles> {
    return this.perRoute;
  }
}

export interface EngineSummary {
  package: Package;
  addons: Set<V2AddonPackage>;
  parent: EngineSummary | undefined;
  sourcePath: string;
  destPath: string;
}

export interface Engine extends EngineSummary {
  appFiles: AppFiles;
}
