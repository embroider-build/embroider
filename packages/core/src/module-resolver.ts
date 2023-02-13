import { emberVirtualPackages, emberVirtualPeerDeps, packageName as getPackageName } from '@embroider/shared-internals';
import { dirname, resolve, posix } from 'path';
import { PackageCache, Package, V2Package, explicitRelative } from '@embroider/shared-internals';
import { compile } from './js-handlebars';
import makeDebug from 'debug';
import assertNever from 'assert-never';
import resolveModule from 'resolve';

const debug = makeDebug('embroider:resolver');

export interface Options {
  renamePackages: {
    [fromName: string]: string;
  };
  renameModules: {
    [fromName: string]: string;
  };
  extraImports: {
    absPath: string;
    target: string;
    runtimeName?: string;
  }[];
  activeAddons: {
    [packageName: string]: string;
  };
  relocatedFiles: { [relativePath: string]: string };
  resolvableExtensions: string[];
  appRoot: string;
  engines: EngineConfig[];
}

interface EngineConfig {
  packageName: string;
  activeAddons: { name: string; root: string }[];
  root: string;
}

const externalPrefix = '/@embroider/external/';

export interface ModuleRequest {
  specifier: string;
  fromFile: string;
  isVirtual: boolean;
  alias(newSpecifier: string): this;
  rehome(newFromFile: string): this;
  virtualize(virtualFilename: string): this;
}

class NodeModuleRequest implements ModuleRequest {
  constructor(readonly specifier: string, readonly fromFile: string, readonly isVirtual = false) {}
  alias(specifier: string): this {
    return new NodeModuleRequest(specifier, this.fromFile) as this;
  }
  rehome(fromFile: string): this {
    return new NodeModuleRequest(this.specifier, fromFile) as this;
  }
  virtualize(filename: string) {
    return new NodeModuleRequest(filename, this.fromFile, true) as this;
  }
}

// This is generic because different build systems have different ways of
// representing a found module, and we just pass those values through.
export type Resolution<T = unknown, E = unknown> = { type: 'found'; result: T } | { type: 'not_found'; err: E };

export type ResolverFunction<R extends ModuleRequest = ModuleRequest, Res extends Resolution = Resolution> = (
  request: R
) => Promise<Res>;

export type SyncResolverFunction<R extends ModuleRequest = ModuleRequest, Res extends Resolution = Resolution> = (
  request: R
) => Res;

export class Resolver {
  // Given a filename that was passed to your ModuleRequest's `virtualize()`,
  // this produces the corresponding contents. It's a static, stateless function
  // because we recognize that that process that did resolution might not be the
  // same one that loads the content.
  static virtualContent(filename: string): string {
    if (filename.startsWith(externalPrefix)) {
      return externalShim({ moduleName: filename.slice(externalPrefix.length) });
    }
    throw new Error(`not an @embroider/core virtual file: ${filename}`);
  }

  constructor(private options: Options) {}

  beforeResolve<R extends ModuleRequest>(request: R): R {
    if (request.specifier === '@embroider/macros') {
      // the macros package is always handled directly within babel (not
      // necessarily as a real resolvable package), so we should not mess with it.
      // It might not get compiled away until *after* our plugin has run, which is
      // why we need to know about it.
      return request;
    }

    return this.preHandleExternal(this.handleRenaming(request));
  }

  // This encapsulates the whole resolving process. Given a `defaultResolve`
  // that calls your build system's normal module resolver, this does both pre-
  // and post-resolution adjustments as needed to implement our compatibility
  // rules.
  //
  // Depending on the plugin architecture you're working in, it may be easier to
  // call beforeResolve and fallbackResolve directly, in which case matching the
  // details of the recursion to what this method does are your responsibility.
  async resolve<Req extends ModuleRequest, Res extends Resolution>(
    request: Req,
    defaultResolve: ResolverFunction<Req, Res>
  ): Promise<Res> {
    let gen = this.internalResolve<Req, Res, Promise<Res>>(request, defaultResolve);
    let out = gen.next();
    while (!out.done) {
      out = gen.next(await out.value);
    }
    return out.value;
  }

  // synchronous alternative to resolve() above. Because our own internals are
  // all synchronous, you can use this if your defaultResolve function is
  // synchronous. At present, we need this for the case where we are compiling
  // non-strict templates and doing component resolutions inside the template
  // compiler inside babel, which is a synchronous context.
  resolveSync<Req extends ModuleRequest, Res extends Resolution>(
    request: Req,
    defaultResolve: SyncResolverFunction<Req, Res>
  ): Res {
    let gen = this.internalResolve<Req, Res, Res>(request, defaultResolve);
    let out = gen.next();
    while (!out.done) {
      out = gen.next(out.value);
    }
    return out.value;
  }

  // Our core implementation is a generator so it can power both resolve() and
  // resolveSync()
  private *internalResolve<Req extends ModuleRequest, Res extends Resolution, Yielded>(
    request: Req,
    defaultResolve: (req: Req) => Yielded
  ): Generator<Yielded, Res, Res> {
    request = this.beforeResolve(request);
    let resolution = yield defaultResolve(request);

    switch (resolution.type) {
      case 'found':
        return resolution;
      case 'not_found':
        break;
      default:
        throw assertNever(resolution);
    }
    let nextRequest = this.fallbackResolve(request);
    if (nextRequest === request) {
      // no additional fallback is available.
      return resolution;
    }
    if (nextRequest.isVirtual) {
      // virtual requests are terminal, there is no more beforeResolve or
      // fallbackResolve around them. The defaultResolve is expected to know how
      // to implement them.
      return yield defaultResolve(nextRequest);
    }
    return yield* this.internalResolve(nextRequest, defaultResolve);
  }

  // Use standard NodeJS resolving, with our required compatibility rules on
  // top. This is a convenience method for calling resolveSync with the
  // defaultResolve already configured to be "do the normal node thing".
  nodeResolve(
    specifier: string,
    fromFile: string
  ): { type: 'virtual'; content: string } | { type: 'real'; filename: string } | { type: 'not_found'; err: Error } {
    let resolution = this.resolveSync(new NodeModuleRequest(specifier, fromFile), request => {
      if (request.isVirtual) {
        return {
          type: 'found',
          result: { type: 'virtual' as 'virtual', content: Resolver.virtualContent(request.specifier) },
        };
      }
      try {
        let filename = resolveModule.sync(request.specifier, {
          basedir: dirname(request.fromFile),
          extensions: this.options.resolvableExtensions,
        });
        return { type: 'found', result: { type: 'real' as 'real', filename } };
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
        return { type: 'not_found', err };
      }
    });
    switch (resolution.type) {
      case 'not_found':
        return resolution;
      case 'found':
        return resolution.result;
      default:
        throw assertNever(resolution);
    }
  }

  private owningPackage(fromFile: string): Package | undefined {
    return PackageCache.shared('embroider-stage3', this.options.appRoot).ownerOfFile(fromFile);
  }

  private originalPackage(fromFile: string): V2Package | undefined {
    let originalFile = this.options.relocatedFiles[fromFile];
    if (originalFile) {
      let owning = PackageCache.shared('embroider-stage3', this.options.appRoot).ownerOfFile(originalFile);
      if (owning && !owning.isV2Ember()) {
        throw new Error(`bug: it should only be possible for a v2 ember package to own relocated files`);
      }
      return owning;
    }
  }

  private handleRenaming<R extends ModuleRequest>(request: R): R {
    let packageName = getPackageName(request.specifier);
    if (!packageName) {
      return request;
    }

    for (let [candidate, replacement] of Object.entries(this.options.renameModules)) {
      if (candidate === request.specifier) {
        debug(`[beforeResolve] aliased ${request.specifier} in ${request.fromFile} to ${replacement}`);
        return request.alias(replacement);
      }
      for (let extension of this.options.resolvableExtensions) {
        if (candidate === request.specifier + '/index' + extension) {
          return request.alias(replacement);
        }
        if (candidate === request.specifier + extension) {
          return request.alias(replacement);
        }
      }
    }

    if (this.options.renamePackages[packageName]) {
      return request.alias(request.specifier.replace(packageName, this.options.renamePackages[packageName]));
    }

    let pkg = this.owningPackage(request.fromFile);
    if (!pkg || !pkg.isV2Ember()) {
      return request;
    }

    if (pkg.meta['auto-upgraded'] && pkg.name === packageName) {
      // we found a self-import, resolve it for them. Only auto-upgraded
      // packages get this help, v2 packages are natively supposed to make their
      // own modules resolvable, and we want to push them all to do that
      // correctly.
      return this.resolveWithinPackage(request, pkg);
    }

    let originalPkg = this.originalPackage(request.fromFile);
    if (originalPkg && pkg.meta['auto-upgraded'] && originalPkg.name === packageName) {
      // A file that was relocated out of a package is importing that package's
      // name, it should find its own original copy.
      return this.resolveWithinPackage(request, originalPkg);
    }

    return request;
  }

  private resolveWithinPackage<R extends ModuleRequest>(request: R, pkg: Package): R {
    if ('exports' in pkg.packageJSON) {
      // this is the easy case -- a package that uses exports can safely resolve
      // its own name, so it's enough to let it resolve the (self-targeting)
      // sepcifier from its own package root.
      return request.rehome(resolve(pkg.root, 'package.json'));
    } else {
      // otherwise we need to just assume that internal naming is simple
      return request.alias(request.specifier.replace(pkg.name, '.')).rehome(resolve(pkg.root, 'package.json'));
    }
  }

  private preHandleExternal<R extends ModuleRequest>(request: R): R {
    let { specifier, fromFile } = request;
    const pkg = this.owningPackage(fromFile);
    if (!pkg || !pkg.isV2Ember()) {
      return request;
    }

    let packageName = getPackageName(specifier);
    if (!packageName) {
      // This is a relative import. We don't automatically externalize those
      // because it's rare, and by keeping them static we give better errors. But
      // we do allow them to be explicitly externalized by the package author (or
      // a compat adapter). In the metadata, they would be listed in
      // package-relative form, so we need to convert this specifier to that.
      let absoluteSpecifier = resolve(dirname(fromFile), specifier);
      let packageRelativeSpecifier = explicitRelative(pkg.root, absoluteSpecifier);
      if (isExplicitlyExternal(packageRelativeSpecifier, pkg)) {
        let publicSpecifier = absoluteSpecifier.replace(pkg.root, pkg.name);
        return external('beforeResolve', request, publicSpecifier);
      }

      // if the requesting file is in an addon's app-js, the relative request
      // should really be understood as a request for a module in the containing
      // engine
      let logicalLocation = this.reverseSearchAppTree(pkg, request.fromFile);
      if (logicalLocation) {
        return request.rehome(resolve(logicalLocation.owningEngine.root, logicalLocation.inAppName));
      }

      return request;
    }

    // absolute package imports can also be explicitly external based on their
    // full specifier name
    if (isExplicitlyExternal(specifier, pkg)) {
      return external('beforeResolve', request, specifier);
    }

    if (!pkg.meta['auto-upgraded'] && emberVirtualPeerDeps.has(packageName)) {
      // Native v2 addons are allowed to use the emberVirtualPeerDeps like
      // `@glimmer/component`. And like all v2 addons, it's important that they
      // see those dependencies after those dependencies have been converted to
      // v2.
      //
      // But unlike auto-upgraded addons, native v2 addons are not necessarily
      // copied out of their original place in node_modules. And from that
      // original place they might accidentally resolve the emberVirtualPeerDeps
      // that are present there in v1 format.
      //
      // So before we let normal resolving happen, we adjust these imports to
      // point at the app's copies instead.
      if (!this.options.activeAddons[packageName]) {
        throw new Error(`${pkg.name} is trying to import the app's ${packageName} package, but it seems to be missing`);
      }
      let newHome = resolve(this.options.appRoot, 'package.json');
      debug(`[beforeResolve] rehomed ${request.specifier} from ${request.fromFile} to ${newHome}`);
      return request.rehome(newHome);
    }

    let logicalPkg = this.logicalPackage(pkg, request.fromFile);
    if (logicalPkg.meta['auto-upgraded'] && !logicalPkg.hasDependency('ember-auto-import')) {
      try {
        let dep = PackageCache.shared('embroider-stage3', this.options.appRoot).resolve(packageName, logicalPkg);
        if (!dep.isEmberPackage()) {
          // classic ember addons can only import non-ember dependencies if they
          // have ember-auto-import.
          return external('beforeResolve', request, specifier);
        }
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
      }
    }

    // assertions on what native v2 addons can import
    if (!pkg.meta['auto-upgraded']) {
      let originalPkg = this.originalPackage(fromFile);
      if (originalPkg) {
        // this file has been moved into another package (presumably the app).
        if (packageName !== pkg.name) {
          // the only thing that native v2 addons are allowed to import from
          // within the app tree is their own name.
          throw new Error(
            `${pkg.name} is trying to import ${packageName} from within its app tree. This is unsafe, because ${pkg.name} can't control which dependencies are resolvable from the app`
          );
        }
      } else {
        // this file has not been moved. The normal case.
        if (!pkg.meta['auto-upgraded'] && !reliablyResolvable(pkg, packageName)) {
          throw new Error(
            `${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`
          );
        }
      }
    }
    return request;
  }

  fallbackResolve<R extends ModuleRequest>(request: R): R {
    let { specifier, fromFile } = request;
    let pkg = this.owningPackage(fromFile);
    if (!pkg || !pkg.isV2Ember()) {
      return request;
    }

    let packageName = getPackageName(specifier);
    if (!packageName) {
      // this is a relative import

      let withinEngine = this.engineConfig(pkg.name);
      if (withinEngine) {
        // it's a relative import inside an engine (which also means app), which
        // means we may need to satisfy the request via app tree merging.
        let appJSMatch = this.searchAppTree(request, withinEngine, unrelativize(pkg, request));
        if (appJSMatch) {
          return appJSMatch;
        }
      }

      // nothing else to do for relative imports
      return request;
    }

    let originalPkg = this.originalPackage(fromFile);
    if (originalPkg) {
      // we didn't find it from the original package, so try from the relocated
      // package
      return request.rehome(resolve(originalPkg.root, 'package.json'));
    }

    // auto-upgraded packages can fall back to the set of known active addons
    //
    // v2 packages can fall back to the set of known active addons only to find
    // themselves (which is needed due to app tree merging)
    if ((pkg.meta['auto-upgraded'] || packageName === pkg.name) && this.options.activeAddons[packageName]) {
      return this.resolveWithinPackage(
        request,
        PackageCache.shared('embroider-stage3', this.options.appRoot).get(this.options.activeAddons[packageName])
      );
    }

    let targetingEngine = this.engineConfig(packageName);
    if (targetingEngine) {
      let appJSMatch = this.searchAppTree(request, targetingEngine, specifier);
      if (appJSMatch) {
        return appJSMatch;
      }
    }

    let logicalLocation = this.reverseSearchAppTree(pkg, request.fromFile);
    if (logicalLocation) {
      // the requesting file is in an addon's appTree. We didn't succeed in
      // resolving this (non-relative) request from inside the actual addon, so
      // next try to resolve it from the corresponding logical location in the
      // app.
      return request.rehome(resolve(logicalLocation.owningEngine.root, logicalLocation.inAppName));
    }

    if (pkg.meta['auto-upgraded']) {
      // auto-upgraded packages can fall back to attempting to find dependencies at
      // runtime. Native v2 packages can only get this behavior in the
      // isExplicitlyExternal case above because they need to explicitly ask for
      // externals.
      return external('fallbackResolve', request, specifier);
    } else {
      // native v2 packages don't automatically externalize *everything* the way
      // auto-upgraded packages do, but they still externalize known and approved
      // ember virtual packages (like @ember/component)
      if (emberVirtualPackages.has(packageName)) {
        return external('fallbackResolve', request, specifier);
      }
    }

    // this is falling through with the original specifier which was
    // non-resolvable, which will presumably cause a static build error in stage3.
    return request;
  }

  private engineConfig(packageName: string): EngineConfig | undefined {
    return this.options.engines.find(e => e.packageName === packageName);
  }

  private searchAppTree<R extends ModuleRequest>(
    request: R,
    engine: EngineConfig,
    inEngineSpecifier: string
  ): R | undefined {
    let packageCache = PackageCache.shared('embroider-stage3', this.options.appRoot);
    let targetModule = withoutJSExt(inEngineSpecifier);

    for (let addonConfig of engine.activeAddons) {
      let addon = packageCache.get(addonConfig.root);
      if (!addon.isV2Addon()) {
        continue;
      }
      let appJS = addon.meta['app-js'];
      if (!appJS) {
        continue;
      }
      for (let [inAppName, inAddonName] of Object.entries(appJS)) {
        if (targetModule === withoutJSExt(posix.join(engine.packageName, inAppName))) {
          return request.alias(inAddonName).rehome(posix.join(addon.root, 'package.json'));
        }
      }
    }
  }

  // check whether the given file with the given owningPackage is an addon's
  // appTree, and if so return the notional location within the app (or owning
  // engine) that it "logically" lives at.
  private reverseSearchAppTree(owningPackage: Package, fromFile: string) {
    // if the requesting file is in an addon's app-js, the request should
    // really be understood as a request for a module in the containing engine
    if (owningPackage.isV2Addon()) {
      let appJS = owningPackage.meta['app-js'];
      if (appJS) {
        let fromPackageRelativePath = explicitRelative(owningPackage.root, fromFile);
        for (let [inAppName, inAddonName] of Object.entries(appJS)) {
          if (inAddonName === fromPackageRelativePath) {
            let owningEngine = this.options.engines.find(e => e.activeAddons.find(a => a.root === owningPackage.root));
            if (!owningEngine) {
              throw new Error(
                `bug in @embroider/core/src/module-resolver: cannot figure out the owning engine for ${owningPackage.root}`
              );
            }
            return { owningEngine, inAppName };
          }
        }
      }
    }
  }

  // For a file in an addon's app-js, this will be the owning engine (and
  // remember: the app is an engine). For a normal file, it's the regular owning
  // package.
  private logicalPackage(owningPackage: V2Package, fromFile: string): V2Package {
    let engineInfo = this.reverseSearchAppTree(owningPackage, fromFile);
    if (engineInfo) {
      return PackageCache.shared('embroider-stage3', this.options.appRoot).get(
        engineInfo.owningEngine.root
      ) as V2Package;
    }
    return owningPackage;
  }
}

function isExplicitlyExternal(specifier: string, fromPkg: V2Package): boolean {
  return Boolean(fromPkg.isV2Addon() && fromPkg.meta['externals'] && fromPkg.meta['externals'].includes(specifier));
}

// we don't want to allow things that resolve only by accident that are likely
// to break in other setups. For example: import your dependencies'
// dependencies, or importing your own name from within a monorepo (which will
// work because of the symlinking) without setting up "exports" (which makes
// your own name reliably resolvable)
function reliablyResolvable(pkg: V2Package, packageName: string) {
  if (pkg.hasDependency(packageName)) {
    return true;
  }

  if (pkg.name === packageName && pkg.packageJSON.exports) {
    return true;
  }

  if (emberVirtualPeerDeps.has(packageName) || emberVirtualPackages.has(packageName)) {
    return true;
  }

  return false;
}

function unrelativize(pkg: Package, request: ModuleRequest) {
  if (pkg.packageJSON.exports) {
    throw new Error(`unsupported: engines cannot use package.json exports`);
  }
  return resolve(dirname(request.fromFile), request.specifier).replace(pkg.root, pkg.name);
}

function external<R extends ModuleRequest>(label: string, request: R, specifier: string): R {
  let filename = externalPrefix + specifier;
  debug(`[${label}] virtualized ${request.specifier} as ${filename}`);
  return request.virtualize(filename);
}

const externalShim = compile(`
{{#if (eq moduleName "require")}}
const m = window.requirejs;
{{else}}
const m = window.require("{{{js-string-escape moduleName}}}");
{{/if}}
{{!-
  There are plenty of hand-written AMD defines floating around
  that lack this, and they will break when other build systems
  encounter them.

  As far as I can tell, Ember's loader was already treating this
  case as a module, so in theory we aren't breaking anything by
  marking it as such when other packagers come looking.

  todo: get review on this part.
-}}
if (m.default && !m.__esModule) {
  m.__esModule = true;
}
module.exports = m;
`) as (params: { moduleName: string }) => string;

// this is specifically for app-js handling, where only .js and .hbs are legal
// extensiosn, and only .js is allowed to be an *implied* extension (.hbs must
// be explicit). So when normalizing such paths, it's only a .js suffix that we
// must remove.
function withoutJSExt(filename: string): string {
  return filename.replace(/\.js$/, '');
}
