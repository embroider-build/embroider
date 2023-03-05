import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  extensionsPattern,
  packageName as getPackageName,
} from '@embroider/shared-internals';
import { dirname, resolve } from 'path';
import { PackageCache, Package, V2Package, explicitRelative } from '@embroider/shared-internals';
import makeDebug from 'debug';
import assertNever from 'assert-never';
import resolveModule from 'resolve';
import { virtualExternalModule, virtualPairComponent, virtualContent } from './virtual-content';

const debug = makeDebug('embroider:resolver');
function logTransition<R extends ModuleRequest>(reason: string, before: R, after: R = before): R {
  if (after.isVirtual) {
    debug(`virtualized %s in %s because %s`, before.specifier, before.fromFile, reason);
  } else if (before.specifier !== after.specifier) {
    if (before.fromFile !== after.fromFile) {
      debug(
        `aliased and rehomed: %s to %s, from %s to %s because %s`,
        before.specifier,
        after.specifier,
        before.fromFile,
        after.fromFile,
        reason
      );
    } else {
      debug(`aliased: %s to %s in %s because`, before.specifier, after.specifier, before.fromFile, reason);
    }
  } else if (before.fromFile !== after.fromFile) {
    debug(`rehomed: %s from %s to %s because`, before.specifier, before.fromFile, after.fromFile, reason);
  } else {
    debug(`unchanged: %s in %s because %s`, before.specifier, before.fromFile, reason);
  }
  return after;
}

export interface Options {
  renamePackages: {
    [fromName: string]: string;
  };
  renameModules: {
    [fromName: string]: string;
  };
  // TODO: extraImports should really be in @embroider/compat only, not core
  extraImports: {
    [absPath: string]: {
      dependsOnComponents?: string[]; // these are already standardized in dasherized form
      dependsOnModules?: string[];
    };
  };
  activeAddons: {
    [packageName: string]: string;
  };
  relocatedFiles: { [relativePath: string]: string };
  resolvableExtensions: string[];
  appRoot: string;
  engines: EngineConfig[];
  modulePrefix: string;
  podModulePrefix?: string;
}

interface EngineConfig {
  packageName: string;
  activeAddons: { name: string; root: string }[];
  root: string;
}

const compatPattern = /#embroider_compat\/(?<type>[^\/]+)\/(?<rest>.*)/;

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
  constructor(private options: Options) {}

  beforeResolve<R extends ModuleRequest>(request: R): R {
    if (request.specifier === '@embroider/macros') {
      // the macros package is always handled directly within babel (not
      // necessarily as a real resolvable package), so we should not mess with it.
      // It might not get compiled away until *after* our plugin has run, which is
      // why we need to know about it.
      return logTransition('early exit', request);
    }

    request = this.handleGlobalsCompat(request);
    request = this.handleRenaming(request);
    return this.preHandleExternal(request);
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
  ):
    | { type: 'virtual'; filename: string; content: string }
    | { type: 'real'; filename: string }
    | { type: 'not_found'; err: Error } {
    let resolution = this.resolveSync(new NodeModuleRequest(specifier, fromFile), request => {
      if (request.isVirtual) {
        return {
          type: 'found',
          result: {
            type: 'virtual' as 'virtual',
            content: virtualContent(request.specifier),
            filename: request.specifier,
          },
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

  owningPackage(fromFile: string): Package | undefined {
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

  private handleGlobalsCompat<R extends ModuleRequest>(request: R): R {
    let match = compatPattern.exec(request.specifier);
    if (!match) {
      return request;
    }
    let { type, rest } = match.groups!;
    let fromPkg = this.owningPackage(request.fromFile);
    if (!fromPkg?.isV2Ember()) {
      return request;
    }
    let engine = this.owningEngine(fromPkg);

    switch (type) {
      case 'helpers':
        return this.resolveHelper(rest, engine, request);
      case 'components':
        return this.resolveComponent(rest, engine, request);
      case 'modifiers':
        return this.resolveModifier(rest, engine, request);
      case 'ambiguous':
        return this.resolveHelperOrComponent(rest, engine, request);
      default:
        throw new Error(`bug: unexepected #embroider_compat specifier: ${request.specifier}`);
    }
  }

  private resolveHelper<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    let target = this.parseGlobalPath(path, inEngine);
    return request
      .alias(`${target.packageName}/helpers/${target.memberName}`)
      .rehome(resolve(inEngine.root, 'package.json'));
  }

  private resolveComponent<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    let target = this.parseGlobalPath(path, inEngine);

    let hbsModule: string | null = null;
    let jsModule: string | null = null;

    // first, the various places our template might be.
    for (let candidate of this.componentTemplateCandidates(target.packageName)) {
      let resolution = this.nodeResolve(
        `${target.packageName}${candidate.prefix}${target.memberName}${candidate.suffix}`,
        target.from
      );
      if (resolution.type === 'real') {
        hbsModule = resolution.filename;
        break;
      }
    }

    // then the various places our javascript might be.
    for (let candidate of this.componentJSCandidates(target.packageName)) {
      let resolution = this.nodeResolve(
        `${target.packageName}${candidate.prefix}${target.memberName}${candidate.suffix}`,
        target.from
      );
      // .hbs is a resolvable extension for us, so we need to exclude it here.
      // It matches as a priority lower than .js, so finding an .hbs means
      // there's definitely not a .js.
      if (resolution.type === 'real' && !resolution.filename.endsWith('.hbs')) {
        jsModule = resolution.filename;
        break;
      }
    }

    if (hbsModule) {
      return logTransition(
        `resolveComponent found legacy HBS`,
        request,
        request.virtualize(virtualPairComponent(hbsModule, jsModule))
      );
    } else if (jsModule) {
      return logTransition(`resolveComponent found only JS`, request, request.alias(jsModule).rehome(target.from));
    } else {
      return logTransition(`resolveComponent failed`, request);
    }
  }

  private resolveHelperOrComponent<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    // resolveHelper just rewrites our request to one that should target the
    // component, so here to resolve the ambiguity we need to actually resolve
    // that candidate to see if it works.
    let helperCandidate = this.resolveHelper(path, inEngine, request);
    let helperMatch = this.nodeResolve(helperCandidate.specifier, helperCandidate.fromFile);
    if (helperMatch.type === 'real') {
      return helperCandidate;
    }

    // unlike resolveHelper, resolveComponent already does pre-resolution in
    // order to deal with its own internal ambiguity around JS vs HBS vs
    // colocation.≥
    let componentMatch = this.resolveComponent(path, inEngine, request);
    if (componentMatch !== request) {
      return componentMatch;
    }

    // this is the hard failure case -- we were supposed to find something and
    // didn't. Let the normal resolution process progress so the user gets a
    // normal build error.
    return request;
  }

  private resolveModifier<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    let target = this.parseGlobalPath(path, inEngine);
    return request
      .alias(`${target.packageName}/modifiers/${target.memberName}`)
      .rehome(resolve(inEngine.root, 'package.json'));
  }

  private *componentTemplateCandidates(inPackageName: string) {
    yield { prefix: '/templates/components/', suffix: '' };
    yield { prefix: '/components/', suffix: '/template' };

    let pods = this.podPrefix(inPackageName);
    if (pods) {
      yield { prefix: `${pods}/components/`, suffix: '/template' };
    }
  }

  private *componentJSCandidates(inPackageName: string) {
    yield { prefix: '/components/', suffix: '' };
    yield { prefix: '/components/', suffix: '/component' };

    let pods = this.podPrefix(inPackageName);
    if (pods) {
      yield { prefix: `${pods}/components/`, suffix: '/component' };
    }
  }

  private podPrefix(targetPackageName: string) {
    if (targetPackageName === this.options.modulePrefix && this.options.podModulePrefix) {
      if (!this.options.podModulePrefix.startsWith(this.options.modulePrefix)) {
        throw new Error(
          `Your podModulePrefix (${this.options.podModulePrefix}) does not start with your app module prefix (${this.options.modulePrefix}). Not gonna support that silliness.`
        );
      }
      return this.options.podModulePrefix.slice(this.options.modulePrefix.length);
    }
  }

  // for paths that come from non-strict templates
  private parseGlobalPath(path: string, inEngine: EngineConfig) {
    let parts = path.split('@');
    if (parts.length > 1 && parts[0].length > 0) {
      return { packageName: parts[0], memberName: parts[1], from: resolve(inEngine.root, 'pacakge.json') };
    } else {
      return { packageName: inEngine.packageName, memberName: path, from: resolve(inEngine.root, 'pacakge.json') };
    }
  }

  owningEngine(pkg: Package) {
    if (pkg.root === this.options.appRoot) {
      // the app is always the first engine
      return this.options.engines[0];
    }
    let owningEngine = this.options.engines.find(e => e.activeAddons.find(a => a.root === pkg.root));
    if (!owningEngine) {
      throw new Error(
        `bug in @embroider/core/src/module-resolver: cannot figure out the owning engine for ${pkg.root}`
      );
    }
    return owningEngine;
  }

  private handleRenaming<R extends ModuleRequest>(request: R): R {
    if (request.isVirtual) {
      return request;
    }
    let packageName = getPackageName(request.specifier);
    if (!packageName) {
      return request;
    }

    for (let [candidate, replacement] of Object.entries(this.options.renameModules)) {
      if (candidate === request.specifier) {
        return logTransition(`renameModules`, request, request.alias(replacement));
      }
      for (let extension of this.options.resolvableExtensions) {
        if (candidate === request.specifier + '/index' + extension) {
          return logTransition(`renameModules`, request, request.alias(replacement));
        }
        if (candidate === request.specifier + extension) {
          return logTransition(`renameModules`, request, request.alias(replacement));
        }
      }
    }

    if (this.options.renamePackages[packageName]) {
      return logTransition(
        `renamePackages`,
        request,
        request.alias(request.specifier.replace(packageName, this.options.renamePackages[packageName]))
      );
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
      return logTransition(`v1 self-import`, request, this.resolveWithinPackage(request, pkg));
    }

    let originalPkg = this.originalPackage(request.fromFile);
    if (originalPkg && pkg.meta['auto-upgraded'] && originalPkg.name === packageName) {
      // A file that was relocated out of a package is importing that package's
      // name, it should find its own original copy.
      return logTransition(`self-import in app-js`, request, this.resolveWithinPackage(request, originalPkg));
    }

    return request;
  }

  private resolveWithinPackage<R extends ModuleRequest>(request: R, pkg: Package): R {
    if ('exports' in pkg.packageJSON) {
      // this is the easy case -- a package that uses exports can safely resolve
      // its own name, so it's enough to let it resolve the (self-targeting)
      // specifier from its own package root.
      return request.rehome(resolve(pkg.root, 'package.json'));
    } else {
      // otherwise we need to just assume that internal naming is simple
      return request.alias(request.specifier.replace(pkg.name, '.')).rehome(resolve(pkg.root, 'package.json'));
    }
  }

  private preHandleExternal<R extends ModuleRequest>(request: R): R {
    if (request.isVirtual) {
      return request;
    }
    let { specifier, fromFile } = request;
    let pkg = this.owningPackage(fromFile);
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
      } else {
        return request;
      }
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
      return logTransition(`emberVirtualPeerDeps in v2 addon`, request, request.rehome(newHome));
    }

    if (pkg.meta['auto-upgraded'] && !pkg.hasDependency('ember-auto-import')) {
      try {
        let dep = PackageCache.shared('embroider-stage3', this.options.appRoot).resolve(packageName, pkg);
        if (!dep.isEmberPackage()) {
          // classic ember addons can only import non-ember dependencies if they
          // have ember-auto-import.
          return external('v1 package without auto-import', request, specifier);
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

    if (compatPattern.test(specifier)) {
      // Some kinds of compat requests get rewritten into other things
      // deterministically. For example, "#embroider_compat/helpers/whatever"
      // means only "the-current-engine/helpers/whatever", and if that doesn't
      // actually exist it's that path that will show up as a missing import.
      //
      // But others have an ambiguous meaning. For example,
      // #embroider_compat/components/whatever can mean several different
      // things. If we're unable to find any of them, the actual
      // "#embroider_compat" request will fall through all the way to here.
      //
      // In that case, we don't want to externalize that failure. We know it's
      // not a classic runtime thing. It's better to let it be a build error
      // here.
      return request;
    }

    let pkg = this.owningPackage(fromFile);
    if (!pkg || !pkg.isV2Ember()) {
      return request;
    }

    let packageName = getPackageName(specifier);
    if (!packageName) {
      // this is a relative import, we have nothing more to for it.
      return request;
    }

    let originalPkg = this.originalPackage(fromFile);
    if (originalPkg) {
      // we didn't find it from the original package, so try from the relocated
      // package
      return logTransition(`relocation fallback`, request, request.rehome(resolve(originalPkg.root, 'package.json')));
    }

    // auto-upgraded packages can fall back to the set of known active addons
    //
    // v2 packages can fall back to the set of known active addons only to find
    // themselves (which is needed due to app tree merging)
    if ((pkg.meta['auto-upgraded'] || packageName === pkg.name) && this.options.activeAddons[packageName]) {
      return logTransition(
        `activeAddons`,
        request,
        this.resolveWithinPackage(
          request,
          PackageCache.shared('embroider-stage3', this.options.appRoot).get(this.options.activeAddons[packageName])
        )
      );
    }

    if (pkg.meta['auto-upgraded']) {
      // auto-upgraded packages can fall back to attempting to find dependencies at
      // runtime. Native v2 packages can only get this behavior in the
      // isExplicitlyExternal case above because they need to explicitly ask for
      // externals.
      return external('v1 catch-all fallback', request, specifier);
    } else {
      // native v2 packages don't automatically externalize *everything* the way
      // auto-upgraded packages do, but they still externalize known and approved
      // ember virtual packages (like @ember/component)
      if (emberVirtualPackages.has(packageName)) {
        return external('emberVirtualPackages', request, specifier);
      }
    }

    // this is falling through with the original specifier which was
    // non-resolvable, which will presumably cause a static build error in stage3.
    return request;
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
            return { owningEngine: this.owningEngine(owningPackage), inAppName };
          }
        }
      }
    }
  }

  // check if this file is resolvable as a global component, and if so return
  // its dasherized name
  reverseComponentLookup(filename: string): string | undefined {
    const owningPackage = this.owningPackage(filename);
    if (!owningPackage?.isV2Ember()) {
      return;
    }
    let engineConfig = this.options.engines.find(e => e.root === owningPackage.root);
    if (engineConfig) {
      // we're directly inside an engine, so we're potentially resolvable as a
      // global component

      // this kind of mapping is not true in general for all packages, but it
      // *is* true for all classical engines (which includes apps) since they
      // don't support package.json `exports`. As for a future v2 engine or app:
      // this whole method is only relevant for implementing packageRules, which
      // should only be for classic stuff. v2 packages should do the right
      // things from the beginning and not need packageRules about themselves.
      let inAppName = explicitRelative(engineConfig.root, filename);

      return this.tryReverseComponent(engineConfig.packageName, inAppName);
    }

    let engineInfo = this.reverseSearchAppTree(owningPackage, filename);
    if (engineInfo) {
      // we're in some addon's app tree, so we're potentially resolvable as a
      // global component
      return this.tryReverseComponent(engineInfo.owningEngine.packageName, engineInfo.inAppName);
    }
  }

  private tryReverseComponent(inEngineName: string, relativePath: string): string | undefined {
    let extensionless = relativePath.replace(extensionsPattern(this.options.resolvableExtensions), '');
    let candidates = [...this.componentJSCandidates(inEngineName), ...this.componentTemplateCandidates(inEngineName)];
    for (let candidate of candidates) {
      if (extensionless.startsWith(`.${candidate.prefix}`) && extensionless.endsWith(candidate.suffix)) {
        return extensionless.slice(candidate.prefix.length + 1, extensionless.length - candidate.suffix.length);
      }
    }
    return undefined;
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

function external<R extends ModuleRequest>(label: string, request: R, specifier: string): R {
  let filename = virtualExternalModule(specifier);
  return logTransition(label, request, request.virtualize(filename));
}
