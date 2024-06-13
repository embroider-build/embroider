import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  extensionsPattern,
  packageName as getPackageName,
  packageName,
} from '@embroider/shared-internals';
import { dirname, resolve, posix } from 'path';
import type { Package, V2Package } from '@embroider/shared-internals';
import { explicitRelative, RewrittenPackageCache } from '@embroider/shared-internals';
import makeDebug from 'debug';
import assertNever from 'assert-never';
import reversePackageExports from '@embroider/reverse-exports';
import { exports as resolveExports } from 'resolve.exports';

import {
  virtualExternalESModule,
  virtualExternalCJSModule,
  virtualPairComponent,
  fastbootSwitch,
  decodeFastbootSwitch,
  decodeImplicitModules,
} from './virtual-content';
import { Memoize } from 'typescript-memoize';
import { describeExports } from './describe-exports';
import { readFileSync } from 'fs';
import type UserOptions from './options';
import { nodeResolve } from './node-resolve';
import { decodePublicRouteEntrypoint, encodeRouteEntrypoint } from './virtual-route-entrypoint';

const debug = makeDebug('embroider:resolver');

// Using a formatter makes this work lazy so nothing happens when we aren't
// logging. It is unfortunate that formatters are a globally mutable config and
// you can only use single character names, but oh well.
makeDebug.formatters.p = (s: string) => {
  let cwd = process.cwd();
  if (s.startsWith(cwd)) {
    return s.slice(cwd.length + 1);
  }
  return s;
};

function logTransition<R extends ModuleRequest>(reason: string, before: R, after: R = before): R {
  if (after.isVirtual) {
    debug(`[%s:virtualized] %s because %s\n  in    %p`, before.debugType, before.specifier, reason, before.fromFile);
  } else if (after.resolvedTo) {
    debug(`[%s:resolvedTo] %s because %s\n  in    %p`, before.debugType, before.specifier, reason, before.fromFile);
  } else if (before.specifier !== after.specifier) {
    if (before.fromFile !== after.fromFile) {
      debug(
        `[%s:aliased and rehomed] %s to %s\n  because %s\n  from    %p\n  to      %p`,
        before.debugType,
        before.specifier,
        after.specifier,
        reason,
        before.fromFile,
        after.fromFile
      );
    } else {
      debug(`[%s:aliased] %s to %s\n  because %s`, before.debugType, before.specifier, after.specifier, reason);
    }
  } else if (before.fromFile !== after.fromFile) {
    debug(
      `[%s:rehomed] %s, because %s\n  from    %p\n  to      %p`,
      before.debugType,
      before.specifier,
      reason,
      before.fromFile,
      after.fromFile
    );
  } else if (after.isNotFound) {
    debug(`[%s:not-found] %s because %s\n  in    %p`, before.debugType, before.specifier, reason, before.fromFile);
  } else {
    debug(`[%s:unchanged] %s because %s\n  in    %p`, before.debugType, before.specifier, reason, before.fromFile);
  }
  return after;
}

function isTerminal(request: ModuleRequest): boolean {
  return request.isVirtual || request.isNotFound || Boolean(request.resolvedTo);
}

export interface Options {
  renamePackages: {
    [fromName: string]: string;
  };
  renameModules: {
    [fromName: string]: string;
  };
  resolvableExtensions: string[];
  appRoot: string;
  engines: EngineConfig[];
  modulePrefix: string;
  splitAtRoutes?: (RegExp | string)[];
  podModulePrefix?: string;
  amdCompatibility: Required<UserOptions['amdCompatibility']>;
  autoRun: boolean;
  staticAppPaths: string[];
}

// TODO: once we can remove the stage2 entrypoint this type can get streamlined
// to the parts we actually need
export interface EngineConfig {
  packageName: string;
  activeAddons: { name: string; root: string; canResolveFromFile: string }[];
  fastbootFiles: { [appName: string]: { localFilename: string; shadowedFilename: string | undefined } };
  root: string;
  isLazy: boolean;
}

type MergeEntry =
  | {
      type: 'app-only';
      'app-js': {
        specifier: string;
        fromFile: string;
        fromPackageName: string;
      };
    }
  | {
      type: 'fastboot-only';
      'fastboot-js': {
        specifier: string;
        fromFile: string;
        fromPackageName: string;
      };
    }
  | {
      type: 'both';
      'app-js': {
        specifier: string;
        fromFile: string;
        fromPackageName: string;
      };
      'fastboot-js': {
        specifier: string;
        fromFile: string;
        fromPackageName: string;
      };
    };

type MergeMap = Map</* engine root dir */ string, Map</* withinEngineModuleName */ string, MergeEntry>>;

const compatPattern = /#embroider_compat\/(?<type>[^\/]+)\/(?<rest>.*)/;

export interface ModuleRequest<Res extends Resolution = Resolution> {
  readonly specifier: string;
  readonly fromFile: string;
  readonly isVirtual: boolean;
  readonly meta: Record<string, unknown> | undefined;
  readonly debugType: string;
  readonly isNotFound: boolean;
  readonly resolvedTo: Res | undefined;
  alias(newSpecifier: string): this;
  rehome(newFromFile: string): this;
  virtualize(virtualFilename: string): this;
  withMeta(meta: Record<string, any> | undefined): this;
  notFound(): this;
  defaultResolve(): Promise<Res>;
  resolveTo(resolution: Res): this;
}

// This is generic because different build systems have different ways of
// representing a found module, and we just pass those values through.
export type Resolution<T = unknown, E = unknown> =
  | { type: 'found'; filename: string; isVirtual: boolean; result: T }

  // used for requests that are special and don't represent real files that
  // embroider can possibly do anything custom with.
  //
  // the motivating use case for introducing this is Vite's depscan which marks
  // almost everything as "external" as a way to tell esbuild to stop traversing
  // once it has been seen the first time.
  | { type: 'ignored'; result: T }

  // the important thing about this Resolution is that embroider should do its
  // fallback behaviors here.
  | { type: 'not_found'; err: E };

export class Resolver {
  constructor(readonly options: Options) {}

  private async beforeResolve<R extends ModuleRequest>(request: R): Promise<R> {
    if (request.specifier === '@embroider/macros') {
      // the macros package is always handled directly within babel (not
      // necessarily as a real resolvable package), so we should not mess with it.
      // It might not get compiled away until *after* our plugin has run, which is
      // why we need to know about it.
      return logTransition('early exit', request);
    }

    if (request.specifier === 'require') {
      return this.external('early require', request, request.specifier);
    }

    request = this.handleFastbootSwitch(request);
    request = await this.handleGlobalsCompat(request);
    request = this.handleImplicitModules(request);
    request = this.handleImplicitTestScripts(request);
    request = this.handleVendorStyles(request);
    request = this.handleTestSupportStyles(request);
    request = this.handleEntrypoint(request);
    request = this.handleTestEntrypoint(request);
    request = this.handleRouteEntrypoint(request);
    request = this.handleRenaming(request);
    request = this.handleVendor(request);
    // we expect the specifier to be app relative at this point - must be after handleRenaming
    request = this.generateFastbootSwitch(request);
    request = this.preHandleExternal(request);

    // this should probably stay the last step in beforeResolve, because it can
    // rehome requests to their un-rewritten locations, and for the most part we
    // want to be dealing with the rewritten packages.
    request = this.handleRewrittenPackages(request);
    return request;
  }

  // This encapsulates the whole resolving process. Given a `defaultResolve`
  // that calls your build system's normal module resolver, this does both pre-
  // and post-resolution adjustments as needed to implement our compatibility
  // rules.
  async resolve<ResolveResolution extends Resolution>(
    request: ModuleRequest<ResolveResolution>
  ): Promise<ResolveResolution> {
    request = await this.beforeResolve(request);
    if (request.resolvedTo) {
      return request.resolvedTo;
    }

    let resolution = await request.defaultResolve();

    switch (resolution.type) {
      case 'found':
      case 'ignored':
        return resolution;
      case 'not_found':
        break;
      default:
        throw assertNever(resolution);
    }
    let nextRequest = await this.fallbackResolve(request);
    if (nextRequest === request) {
      // no additional fallback is available.
      return resolution;
    }

    if (nextRequest.resolvedTo) {
      return nextRequest.resolvedTo;
    }

    if (nextRequest.fromFile === request.fromFile && nextRequest.specifier === request.specifier) {
      throw new Error(
        'Bug Discovered! New request is not === original request but has the same fromFile and specifier. This will likely create a loop.'
      );
    }

    if (nextRequest.isVirtual || nextRequest.isNotFound) {
      // virtual and NotFound requests are terminal, there is no more
      // beforeResolve or fallbackResolve around them. The defaultResolve is
      // expected to know how to implement them.
      return nextRequest.defaultResolve();
    }

    return this.resolve(nextRequest);
  }

  // Use standard NodeJS resolving, with our required compatibility rules on
  // top. This is a convenience method for calling resolveSync with the
  // defaultResolve already configured to be "do the normal node thing".
  async nodeResolve(
    specifier: string,
    fromFile: string
  ): Promise<
    | { type: 'virtual'; filename: string; content: string }
    | { type: 'real'; filename: string }
    | { type: 'not_found'; err: Error }
  > {
    return nodeResolve(this, specifier, fromFile);
  }

  get packageCache() {
    return RewrittenPackageCache.shared('embroider', this.options.appRoot);
  }

  private logicalPackage(owningPackage: V2Package, file: string): V2Package {
    let logicalLocation = this.reverseSearchAppTree(owningPackage, file);
    if (logicalLocation) {
      let pkg = this.packageCache.get(logicalLocation.owningEngine.root);
      if (!pkg.isV2Ember()) {
        throw new Error(`bug: all engines should be v2 addons by the time we see them here`);
      }
      return pkg;
    }
    return owningPackage;
  }

  private generateFastbootSwitch<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let pkg = this.packageCache.ownerOfFile(request.fromFile);

    if (!pkg) {
      return request;
    }

    if (packageName(request.specifier)) {
      // not a relative request, and we're assuming all within-engine requests
      // are relative by this point due to `v1 self-import` which happens
      // earlier
      return request;
    }

    let engineConfig = this.engineConfig(pkg.name);
    let appRelativePath = explicitRelative(pkg.root, resolve(dirname(request.fromFile), request.specifier));
    if (engineConfig) {
      for (let candidate of this.withResolvableExtensions(appRelativePath)) {
        let fastbootFile = engineConfig.fastbootFiles[candidate];
        if (fastbootFile) {
          if (fastbootFile.shadowedFilename) {
            let { names } = describeExports(readFileSync(resolve(pkg.root, fastbootFile.shadowedFilename), 'utf8'), {
              configFile: false,
            });
            let switchFile = fastbootSwitch(candidate, resolve(pkg.root, 'package.json'), names);
            if (switchFile === request.fromFile) {
              return logTransition('internal lookup from fastbootSwitch', request);
            } else {
              return logTransition('shadowed app fastboot', request, request.virtualize(switchFile));
            }
          } else {
            return logTransition(
              'unshadowed app fastboot',
              request,
              request.alias(fastbootFile.localFilename).rehome(resolve(pkg.root, 'package.json'))
            );
          }
        }
      }
    }

    return request;
  }

  private handleFastbootSwitch<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let match = decodeFastbootSwitch(request.fromFile);
    if (!match) {
      return request;
    }

    let section: 'app-js' | 'fastboot-js' | undefined;
    if (request.specifier === './browser') {
      section = 'app-js';
    } else if (request.specifier === './fastboot') {
      section = 'fastboot-js';
    }

    if (!section) {
      return logTransition('non-special import in fastboot switch', request);
    }

    let pkg = this.packageCache.ownerOfFile(match.filename);
    if (pkg) {
      let rel = explicitRelative(pkg.root, match.filename);

      let engineConfig = this.engineConfig(pkg.name);
      if (engineConfig) {
        let fastbootFile = engineConfig.fastbootFiles[rel];
        if (fastbootFile && fastbootFile.shadowedFilename) {
          let targetFile: string;
          if (section === 'app-js') {
            targetFile = fastbootFile.shadowedFilename;
          } else {
            targetFile = fastbootFile.localFilename;
          }
          return logTransition(
            'matched app entry',
            request,
            // deliberately not using rehome because we want
            // generateFastbootSwitch to see that this request is coming *from*
            // a fastboot switch so it won't cycle back around. Instead we make
            // the targetFile relative to the fromFile that we already have.
            request.alias(explicitRelative(dirname(request.fromFile), resolve(pkg.root, targetFile)))
          );
        }
      }

      let entry = this.getEntryFromMergeMap(rel, pkg.root)?.entry;
      if (entry?.type === 'both') {
        return logTransition(
          'matched addon entry',
          request,
          request.alias(entry[section].specifier).rehome(entry[section].fromFile)
        );
      }
    }

    return logTransition('failed to match in fastboot switch', request);
  }

  private handleImplicitModules<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let im = decodeImplicitModules(request.specifier);
    if (!im) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (!pkg?.isV2Ember()) {
      throw new Error(`bug: found implicit modules import in non-ember package at ${request.fromFile}`);
    }

    let packageName = getPackageName(im.fromFile);
    if (packageName) {
      let dep = this.packageCache.resolve(packageName, pkg);
      return logTransition(
        `dep's implicit modules`,
        request,
        request.virtualize(resolve(dep.root, `-embroider-${im.type}.js`))
      );
    } else {
      return logTransition(
        `own implicit modules`,
        request,
        request.virtualize(resolve(pkg.root, `-embroider-${im.type}.js`))
      );
    }
  }

  private handleEntrypoint<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }

    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = ['@embroider/core/entrypoint', '/@embroider/core/entrypoint', './@embroider/core/entrypoint'];

    if (!candidates.some(c => request.specifier.startsWith(c + '/') || request.specifier === c)) {
      return request;
    }

    const result = /\.?\/?@embroider\/core\/entrypoint(?:\/(?<packageName>.*))?/.exec(request.specifier);

    if (!result) {
      // TODO make a better error
      throw new Error('entrypoint does not match pattern' + request.specifier);
    }

    const { packageName } = result.groups!;

    const requestingPkg = this.packageCache.ownerOfFile(request.fromFile);

    if (!requestingPkg?.isV2Ember()) {
      throw new Error(`bug: found entrypoint import in non-ember package at ${request.fromFile}`);
    }

    let pkg;

    if (packageName) {
      pkg = this.packageCache.resolve(packageName, requestingPkg);
    } else {
      pkg = requestingPkg;
    }

    return logTransition('entrypoint', request, request.virtualize(resolve(pkg.root, '-embroider-entrypoint.js')));
  }

  private handleTestEntrypoint<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }

    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = [
      '@embroider/core/test-entrypoint',
      '/@embroider/core/test-entrypoint',
      './@embroider/core/test-entrypoint',
    ];

    if (!candidates.some(c => request.specifier === c)) {
      return request;
    }

    const pkg = this.packageCache.ownerOfFile(request.fromFile);

    if (!pkg?.isV2Ember() || !pkg.isV2App()) {
      throw new Error(
        `bug: found test entrypoint import from somewhere other than the top-level app engine: ${request.fromFile}`
      );
    }

    return logTransition(
      'test-entrypoint',
      request,
      request.virtualize(resolve(pkg.root, '-embroider-test-entrypoint.js'))
    );
  }

  private handleRouteEntrypoint<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }

    let routeName = decodePublicRouteEntrypoint(request.specifier);

    if (!routeName) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);

    if (!pkg?.isV2Ember()) {
      throw new Error(`bug: found entrypoint import in non-ember package at ${request.fromFile}`);
    }

    return logTransition('route entrypoint', request, request.virtualize(encodeRouteEntrypoint(pkg.root, routeName)));
  }

  private handleImplicitTestScripts<R extends ModuleRequest>(request: R): R {
    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = [
      '@embroider/core/test-support.js',
      '/@embroider/core/test-support.js',
      './@embroider/core/test-support.js',
    ];

    if (!candidates.includes(request.specifier)) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (pkg?.root !== this.options.engines[0].root) {
      throw new Error(
        `bug: found an import of ${request.specifier} in ${request.fromFile}, but this is not the top-level Ember app. The top-level Ember app is the only one that has support for @embroider/core/test-support.js. If you think something should be fixed in Embroider, please open an issue on https://github.com/embroider-build/embroider/issues.`
      );
    }

    return logTransition('test-support', request, request.virtualize(resolve(pkg.root, '-embroider-test-support.js')));
  }

  private handleTestSupportStyles<R extends ModuleRequest>(request: R): R {
    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = [
      '@embroider/core/test-support.css',
      '/@embroider/core/test-support.css',
      './@embroider/core/test-support.css',
    ];

    if (!candidates.includes(request.specifier)) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (pkg?.root !== this.options.engines[0].root) {
      throw new Error(
        `bug: found an import of ${request.specifier} in ${request.fromFile}, but this is not the top-level Ember app. The top-level Ember app is the only one that has support for @embroider/core/test-support.css. If you think something should be fixed in Embroider, please open an issue on https://github.com/embroider-build/embroider/issues.`
      );
    }

    return logTransition(
      'test-support-styles',
      request,
      request.virtualize(resolve(pkg.root, '-embroider-test-support-styles.css'))
    );
  }

  private async handleGlobalsCompat<R extends ModuleRequest>(request: R): Promise<R> {
    if (isTerminal(request)) {
      return request;
    }
    let match = compatPattern.exec(request.specifier);
    if (!match) {
      return request;
    }
    let { type, rest } = match.groups!;
    let fromPkg = this.packageCache.ownerOfFile(request.fromFile);
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

  private handleVendorStyles<R extends ModuleRequest>(request: R): R {
    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = ['@embroider/core/vendor.css', '/@embroider/core/vendor.css', './@embroider/core/vendor.css'];

    if (!candidates.includes(request.specifier)) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (!pkg || !this.options.engines.some(e => e.root === pkg?.root)) {
      throw new Error(
        `bug: found an import of ${request.specifier} in ${request.fromFile}, but this is not the top-level Ember app or Engine. The top-level Ember app is the only one that has support for @embroider/core/vendor.css. If you think something should be fixed in Embroider, please open an issue on https://github.com/embroider-build/embroider/issues.`
      );
    }

    return logTransition(
      'vendor-styles',
      request,
      request.virtualize(resolve(pkg.root, '-embroider-vendor-styles.css'))
    );
  }

  private resolveHelper<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    let target = this.parseGlobalPath(path, inEngine);
    return logTransition(
      'resolveHelper',
      request,
      request.alias(`${target.packageName}/helpers/${target.memberName}`).rehome(resolve(inEngine.root, 'package.json'))
    );
  }

  private async resolveComponent<R extends ModuleRequest>(
    path: string,
    inEngine: EngineConfig,
    request: R
  ): Promise<R> {
    let target = this.parseGlobalPath(path, inEngine);

    let hbsModule: Resolution | null = null;
    let jsModule: Resolution | null = null;

    // first, the various places our template might be.
    for (let candidate of this.componentTemplateCandidates(target.packageName)) {
      let candidateSpecifier = `${target.packageName}${candidate.prefix}${target.memberName}${candidate.suffix}`;

      let resolution = await this.resolve(
        request.alias(candidateSpecifier).rehome(target.from).withMeta({
          runtimeFallback: false,
        })
      );

      if (resolution.type === 'found') {
        hbsModule = resolution;
        break;
      }
    }

    // then the various places our javascript might be.
    for (let candidate of this.componentJSCandidates(target.packageName)) {
      let candidateSpecifier = `${target.packageName}${candidate.prefix}${target.memberName}${candidate.suffix}`;

      let resolution = await this.resolve(
        request.alias(candidateSpecifier).rehome(target.from).withMeta({
          runtimeFallback: false,
        })
      );

      // .hbs is a resolvable extension for us, so we need to exclude it here.
      // It matches as a priority lower than .js, so finding an .hbs means
      // there's definitely not a .js.
      if (resolution.type === 'found' && !resolution.filename.endsWith('.hbs')) {
        jsModule = resolution;
        break;
      }
    }

    if (hbsModule) {
      return logTransition(
        `resolveComponent found legacy HBS`,
        request,
        request.virtualize(virtualPairComponent(hbsModule.filename, jsModule?.filename))
      );
    } else if (jsModule) {
      return logTransition(`resolving to resolveComponent found only JS`, request, request.resolveTo(jsModule));
    } else {
      return logTransition(`resolveComponent failed`, request);
    }
  }

  private async resolveHelperOrComponent<R extends ModuleRequest>(
    path: string,
    inEngine: EngineConfig,
    request: R
  ): Promise<R> {
    // resolveHelper just rewrites our request to one that should target the
    // component, so here to resolve the ambiguity we need to actually resolve
    // that candidate to see if it works.
    let helperCandidate = this.resolveHelper(path, inEngine, request);
    let helperMatch = await this.resolve(
      request.alias(helperCandidate.specifier).rehome(helperCandidate.fromFile).withMeta({
        runtimeFallback: false,
      })
    );

    if (helperMatch.type === 'found') {
      return logTransition('resolve to ambiguous case matched a helper', request, request.resolveTo(helperMatch));
    }

    // unlike resolveHelper, resolveComponent already does pre-resolution in
    // order to deal with its own internal ambiguity around JS vs HBS vs
    // colocation.≥
    let componentMatch = await this.resolveComponent(path, inEngine, request);
    if (componentMatch !== request) {
      return logTransition('ambiguous case matched a cmoponent', request, componentMatch);
    }

    // this is the hard failure case -- we were supposed to find something and
    // didn't. Let the normal resolution process progress so the user gets a
    // normal build error.
    return logTransition('ambiguous case failing', request);
  }

  private resolveModifier<R extends ModuleRequest>(path: string, inEngine: EngineConfig, request: R): R {
    let target = this.parseGlobalPath(path, inEngine);
    return logTransition(
      'resolveModifier',
      request,
      request
        .alias(`${target.packageName}/modifiers/${target.memberName}`)
        .rehome(resolve(inEngine.root, 'package.json'))
    );
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
    yield { prefix: '/components/', suffix: '/index' };
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
      return { packageName: parts[0], memberName: parts[1], from: resolve(inEngine.root, 'package.json') };
    } else {
      return { packageName: inEngine.packageName, memberName: path, from: resolve(inEngine.root, 'package.json') };
    }
  }

  private engineConfig(packageName: string): EngineConfig | undefined {
    return this.options.engines.find(e => e.packageName === packageName);
  }

  // This is where we figure out how all the classic treeForApp merging bottoms
  // out.
  @Memoize()
  private get mergeMap(): MergeMap {
    let result: MergeMap = new Map();
    for (let engine of this.options.engines) {
      let engineModules: Map<string, MergeEntry> = new Map();
      for (let addonConfig of engine.activeAddons) {
        let addon = this.packageCache.get(addonConfig.root);
        if (!addon.isV2Addon()) {
          continue;
        }

        let appJS = addon.meta['app-js'];
        if (appJS) {
          for (let [inEngineName, inAddonName] of Object.entries(appJS)) {
            if (!inEngineName.startsWith('./')) {
              throw new Error(
                `addon ${addon.name} declares app-js in its package.json with the illegal name "${inEngineName}". It must start with "./" to make it clear that it's relative to the app`
              );
            }
            if (!inAddonName.startsWith('./')) {
              throw new Error(
                `addon ${addon.name} declares app-js in its package.json with the illegal name "${inAddonName}". It must start with "./" to make it clear that it's relative to the addon`
              );
            }
            let prevEntry = engineModules.get(inEngineName);
            switch (prevEntry?.type) {
              case undefined:
                engineModules.set(inEngineName, {
                  type: 'app-only',
                  'app-js': {
                    specifier: reversePackageExports(addon.packageJSON, inAddonName),
                    fromFile: addonConfig.canResolveFromFile,
                    fromPackageName: addon.name,
                  },
                });
                break;
              case 'app-only':
              case 'both':
                // first match wins, so this one is shadowed
                break;
              case 'fastboot-only':
                engineModules.set(inEngineName, {
                  type: 'both',
                  'app-js': {
                    specifier: reversePackageExports(addon.packageJSON, inAddonName),
                    fromFile: addonConfig.canResolveFromFile,
                    fromPackageName: addon.name,
                  },
                  'fastboot-js': prevEntry['fastboot-js'],
                });
                break;
            }
          }
        }

        let fastbootJS = addon.meta['fastboot-js'];
        if (fastbootJS) {
          for (let [inEngineName, inAddonName] of Object.entries(fastbootJS)) {
            if (!inEngineName.startsWith('./')) {
              throw new Error(
                `addon ${addon.name} declares fastboot-js in its package.json with the illegal name "${inEngineName}". It must start with "./" to make it clear that it's relative to the app`
              );
            }
            if (!inAddonName.startsWith('./')) {
              throw new Error(
                `addon ${addon.name} declares fastboot-js in its package.json with the illegal name "${inAddonName}". It must start with "./" to make it clear that it's relative to the addon`
              );
            }
            let prevEntry = engineModules.get(inEngineName);
            switch (prevEntry?.type) {
              case undefined:
                engineModules.set(inEngineName, {
                  type: 'fastboot-only',
                  'fastboot-js': {
                    specifier: reversePackageExports(addon.packageJSON, inAddonName),
                    fromFile: addonConfig.canResolveFromFile,
                    fromPackageName: addon.name,
                  },
                });
                break;
              case 'fastboot-only':
              case 'both':
                // first match wins, so this one is shadowed
                break;
              case 'app-only':
                engineModules.set(inEngineName, {
                  type: 'both',
                  'fastboot-js': {
                    specifier: reversePackageExports(addon.packageJSON, inAddonName),
                    fromFile: addonConfig.canResolveFromFile,
                    fromPackageName: addon.name,
                  },
                  'app-js': prevEntry['app-js'],
                });
                break;
            }
          }
        }
      }
      result.set(engine.root, engineModules);
    }
    return result;
  }

  owningEngine(pkg: Package) {
    let owningEngine = this.options.engines.find(e =>
      pkg.isEngine() ? e.root === pkg.root : e.activeAddons.find(a => a.root === pkg.root)
    );
    if (!owningEngine) {
      throw new Error(
        `bug in @embroider/core/src/module-resolver: cannot figure out the owning engine for ${pkg.root}`
      );
    }
    return owningEngine;
  }

  private handleRewrittenPackages<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let requestingPkg = this.packageCache.ownerOfFile(request.fromFile);
    if (!requestingPkg) {
      return request;
    }
    let packageName = getPackageName(request.specifier);
    if (!packageName) {
      // relative request
      return request;
    }

    let targetPkg: Package | undefined;
    if (packageName !== requestingPkg.name) {
      // non-relative, non-self request, so check if it aims at a rewritten addon
      try {
        targetPkg = this.packageCache.resolve(packageName, requestingPkg);
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
      }
    }

    let originalRequestingPkg = this.packageCache.original(requestingPkg);
    let originalTargetPkg = targetPkg ? this.packageCache.original(targetPkg) : undefined;

    if (targetPkg && originalTargetPkg !== targetPkg) {
      // in this case it doesn't matter whether or not the requesting package
      // was moved. RewrittenPackageCache.resolve already took care of finding
      // the right target, and we redirect the request so it will look inside
      // that target.
      return logTransition(
        'request targets a moved package',
        request,
        this.resolveWithinMovedPackage(request, targetPkg)
      );
    } else if (originalRequestingPkg !== requestingPkg) {
      if (targetPkg) {
        // in this case, the requesting package is moved but its destination is
        // not, so we need to rehome the request back to the original location.
        return logTransition(
          'outbound request from moved package',
          request,
          request
            // setting meta here because if this fails, we want the fallback
            // logic to revert our rehome and continue from the *moved* package.
            .withMeta({ originalFromFile: request.fromFile })
            .rehome(resolve(originalRequestingPkg.root, 'package.json'))
        );
      } else {
        // requesting package was moved and we failed to find its target. We
        // can't let that accidentally succeed in the defaultResolve because we
        // could escape the moved package system.
        return logTransition('missing outbound request from moved package', request, request.notFound());
      }
    }

    return request;
  }

  private handleRenaming<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let packageName = getPackageName(request.specifier);
    if (!packageName) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (!pkg || !pkg.isV2Ember()) {
      return request;
    }

    // real deps take precedence over renaming rules. That is, a package like
    // ember-source might provide backburner via module renaming, but if you
    // have an explicit dependency on backburner you should still get that real
    // copy.
    if (!reliablyResolvable(pkg, packageName)) {
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
    }

    if (pkg.name === packageName) {
      // we found a self-import
      if (pkg.meta['auto-upgraded']) {
        // auto-upgraded packages always get automatically adjusted. They never
        // supported fancy package.json exports features so this direct mapping
        // to the root is always right.

        // "my-package/foo" -> "./foo"
        // "my-package" -> "./" (this can't be just "." because node's require.resolve doesn't reliable support that)
        let selfImportPath = request.specifier === pkg.name ? './' : request.specifier.replace(pkg.name, '.');

        return logTransition(
          `v1 self-import`,
          request,
          request.alias(selfImportPath).rehome(resolve(pkg.root, 'package.json'))
        );
      } else {
        // v2 packages are supposed to use package.json `exports` to enable
        // self-imports, but not all build tools actually follow the spec. This
        // is a workaround for badly behaved packagers.
        //
        // Known upstream bugs this works around:
        // - https://github.com/vitejs/vite/issues/9731
        if (pkg.packageJSON.exports) {
          let found = resolveExports(pkg.packageJSON, request.specifier, {
            browser: true,
            conditions: ['default', 'imports'],
          });
          if (found?.[0]) {
            return logTransition(
              `v2 self-import with package.json exports`,
              request,
              request.alias(found?.[0]).rehome(resolve(pkg.root, 'package.json'))
            );
          }
        }
      }
    }

    return request;
  }

  private handleVendor<R extends ModuleRequest>(request: R): R {
    //TODO move the extra forwardslash handling out into the vite plugin
    const candidates = ['@embroider/core/vendor.js', '/@embroider/core/vendor.js', './@embroider/core/vendor.js'];

    if (!candidates.includes(request.specifier)) {
      return request;
    }

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (pkg?.root !== this.options.engines[0].root) {
      throw new Error(
        `bug: found an import of ${request.specifier} in ${request.fromFile}, but this is not the top-level Ember app. The top-level Ember app is the only one that has support for @embroider/core/vendor.js. If you think something should be fixed in Embroider, please open an issue on https://github.com/embroider-build/embroider/issues.`
      );
    }

    return logTransition('vendor', request, request.virtualize(resolve(pkg.root, '-embroider-vendor.js')));
  }

  private resolveWithinMovedPackage<R extends ModuleRequest>(request: R, pkg: Package): R {
    let levels = ['..'];
    if (pkg.name.startsWith('@')) {
      levels.push('..');
    }
    let originalFromFile = request.fromFile;
    let newRequest = request.rehome(resolve(pkg.root, ...levels, 'moved-package-target.js'));

    if (newRequest === request) {
      return request;
    }

    // setting meta because if this fails, we want the fallback to pick up back
    // in the original requesting package.
    return newRequest.withMeta({ originalFromFile });
  }

  private preHandleExternal<R extends ModuleRequest>(request: R): R {
    if (isTerminal(request)) {
      return request;
    }
    let { specifier, fromFile } = request;
    let pkg = this.packageCache.ownerOfFile(fromFile);
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

      if (!absoluteSpecifier.startsWith(pkg.root)) {
        // this relative path escape its package. So it's not really using
        // normal inter-package resolving and we should leave it alone. This
        // case comes up especially when babel transforms are trying to insert
        // references to runtime utilities, like we do in @embroider/macros.
        return logTransition('beforeResolve: relative path escapes its package', request);
      }

      let packageRelativeSpecifier = explicitRelative(pkg.root, absoluteSpecifier);
      if (isExplicitlyExternal(packageRelativeSpecifier, pkg)) {
        let publicSpecifier = absoluteSpecifier.replace(pkg.root, pkg.name);
        return this.external('beforeResolve', request, publicSpecifier);
      }

      // if the requesting file is in an addon's app-js, the relative request
      // should really be understood as a request for a module in the containing
      // engine
      let logicalLocation = this.reverseSearchAppTree(pkg, request.fromFile);
      if (logicalLocation) {
        return logTransition(
          'beforeResolve: relative import in app-js',
          request,
          request
            .alias('./' + posix.join(dirname(logicalLocation.inAppName), request.specifier))
            // it's important that we're rehoming this to the root of the engine
            // (which we know really exists), and not to a subdir like
            // logicalLocation.inAppName (which might not physically exist),
            // because some environments (including node's require.resolve) will
            // refuse to do resolution from a notional path that doesn't
            // physically exist.
            .rehome(resolve(logicalLocation.owningEngine.root, 'package.json'))
        );
      }

      return request;
    }

    // absolute package imports can also be explicitly external based on their
    // full specifier name
    if (isExplicitlyExternal(specifier, pkg)) {
      return this.external('beforeResolve', request, specifier);
    }

    if (emberVirtualPackages.has(packageName) && !pkg.hasDependency(packageName)) {
      return this.external('beforeResolve emberVirtualPackages', request, specifier);
    }

    if (emberVirtualPeerDeps.has(packageName) && !pkg.hasDependency(packageName)) {
      // addons (whether auto-upgraded or not) may use the app's
      // emberVirtualPeerDeps, like "@glimmer/component" etc.
      let addon = this.locateActiveAddon(packageName);
      if (!addon) {
        throw new Error(
          `${pkg.name} is trying to import the emberVirtualPeerDep "${packageName}", but it seems to be missing`
        );
      }
      return logTransition(`emberVirtualPeerDeps`, request, request.rehome(addon.canResolveFromFile));
    }

    // if this file is part of an addon's app-js, it's really the logical
    // package to which it belongs (normally the app) that affects some policy
    // choices about what it can import
    let logicalPackage = this.logicalPackage(pkg, fromFile);

    if (logicalPackage.meta['auto-upgraded'] && !logicalPackage.hasDependency('ember-auto-import')) {
      try {
        let dep = this.packageCache.resolve(packageName, logicalPackage);
        if (!dep.isEmberAddon()) {
          // classic ember addons can only import non-ember dependencies if they
          // have ember-auto-import.
          return this.external('v1 package without auto-import', request, specifier);
        }
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
      }
    }

    // assertions on what native v2 addons can import
    if (!pkg.meta['auto-upgraded']) {
      if (
        !appImportInAppTree(pkg, logicalPackage, packageName) &&
        !reliablyResolvable(pkg, packageName) &&
        !emberVirtualPeerDeps.has(packageName) &&
        !emberVirtualPackages.has(packageName)
      ) {
        throw new Error(
          `${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`
        );
      }
    }
    return request;
  }

  private locateActiveAddon(packageName: string): { root: string; canResolveFromFile: string } | undefined {
    if (packageName === this.options.modulePrefix) {
      // the app itself is something that addon's can classically resolve if they know it's name.
      return {
        root: this.options.appRoot,
        canResolveFromFile: resolve(
          this.packageCache.maybeMoved(this.packageCache.get(this.options.appRoot)).root,
          'package.json'
        ),
      };
    }
    for (let engine of this.options.engines) {
      for (let addon of engine.activeAddons) {
        if (addon.name === packageName) {
          return addon;
        }
      }
    }
  }

  private external<R extends ModuleRequest>(label: string, request: R, specifier: string): R {
    if (this.options.amdCompatibility === 'cjs') {
      let filename = virtualExternalCJSModule(specifier);
      return logTransition(label, request, request.virtualize(filename));
    } else if (this.options.amdCompatibility) {
      let entry = this.options.amdCompatibility.es.find(
        entry => entry[0] === specifier || entry[0] + '/index' === specifier
      );
      if (!entry && request.specifier === 'require') {
        entry = ['require', ['default', 'has']];
      }
      if (!entry) {
        throw new Error(
          `A module tried to resolve "${request.specifier}" and didn't find it (${label}).

 - Maybe a dependency declaration is missing?
 - Remember that v1 addons can only import non-Ember-addon NPM dependencies if they include ember-auto-import in their dependencies.
 - If this dependency is available in the AMD loader (because someone manually called "define()" for it), you can configure a shim like:

  amdCompatibility: {
    es: [
      ["${request.specifier}", ["default", "yourNamedExportsGoHere"]],
    ]
  }

`
        );
      }
      let filename = virtualExternalESModule(specifier, entry[1]);
      return logTransition(label, request, request.virtualize(filename));
    } else {
      throw new Error(
        `Embroider's amdCompatibility option is disabled, but something tried to use it to access "${request.specifier}"`
      );
    }
  }

  private async fallbackResolve<R extends ModuleRequest>(request: R): Promise<R> {
    if (request.isVirtual) {
      throw new Error(
        'Build tool bug detected! Fallback resolve should never see a virtual request. It is expected that the defaultResolve for your bundler has already resolved this request'
      );
    }

    if (request.specifier === '@embroider/macros') {
      // the macros package is always handled directly within babel (not
      // necessarily as a real resolvable package), so we should not mess with it.
      // It might not get compiled away until *after* our plugin has run, which is
      // why we need to know about it.
      return logTransition('fallback early exit', request);
    }

    if (compatPattern.test(request.specifier)) {
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

    let pkg = this.packageCache.ownerOfFile(request.fromFile);
    if (!pkg) {
      return logTransition('no identifiable owningPackage', request);
    }

    // meta.originalFromFile gets set when we want to try to rehome a request
    // but then come back to the original location here in the fallback when the
    // rehomed request fails
    let movedPkg = this.packageCache.maybeMoved(pkg);
    if (movedPkg !== pkg) {
      let originalFromFile = request.meta?.originalFromFile;
      if (typeof originalFromFile !== 'string') {
        throw new Error(`bug: embroider resolver's meta is not propagating`);
      }
      request = request.rehome(originalFromFile);
      pkg = movedPkg;
    }

    if (!pkg.isV2Ember()) {
      return logTransition('fallbackResolve: not in an ember package', request);
    }

    let packageName = getPackageName(request.specifier);
    if (!packageName) {
      // this is a relative import

      let withinEngine = this.engineConfig(pkg.name);
      if (withinEngine) {
        // it's a relative import inside an engine (which also means app), which
        // means we may need to satisfy the request via app tree merging.
        let appJSMatch = await this.searchAppTree(
          request,
          withinEngine,
          explicitRelative(pkg.root, resolve(dirname(request.fromFile), request.specifier))
        );
        if (appJSMatch) {
          return logTransition('fallbackResolve: relative appJsMatch', request, appJSMatch);
        } else {
          return logTransition('fallbackResolve: relative appJs search failure', request);
        }
      } else {
        // nothing else to do for relative imports
        return logTransition('fallbackResolve: relative failure', request);
      }
    }

    // auto-upgraded packages can fall back to the set of known active addons
    if (pkg.meta['auto-upgraded']) {
      let addon = this.locateActiveAddon(packageName);
      if (addon) {
        const rehomed = request.rehome(addon.canResolveFromFile);
        if (rehomed !== request) {
          return logTransition(`activeAddons`, request, rehomed);
        }
      }
    }

    let logicalLocation = this.reverseSearchAppTree(pkg, request.fromFile);
    if (logicalLocation) {
      // the requesting file is in an addon's appTree. We didn't succeed in
      // resolving this (non-relative) request from inside the actual addon, so
      // next try to resolve it from the corresponding logical location in the
      // app.
      return logTransition(
        'fallbackResolve: retry from logical home of app-js file',
        request,
        // it might look more precise to rehome into logicalLocation.inAppName
        // rather than package.json. But that logical location may not actually
        // exist, and some systems (including node's require.resolve) will be
        // mad about trying to resolve from notional paths that don't really
        // exist.
        request.rehome(resolve(logicalLocation.owningEngine.root, 'package.json'))
      );
    }

    let targetingEngine = this.engineConfig(packageName);
    if (targetingEngine) {
      let appJSMatch = await this.searchAppTree(request, targetingEngine, request.specifier.replace(packageName, '.'));
      if (appJSMatch) {
        return logTransition('fallbackResolve: non-relative appJsMatch', request, appJSMatch);
      }
    }

    if (pkg.meta['auto-upgraded'] && (request.meta?.runtimeFallback ?? true)) {
      // auto-upgraded packages can fall back to attempting to find dependencies at
      // runtime. Native v2 packages can only get this behavior in the
      // isExplicitlyExternal case above because they need to explicitly ask for
      // externals.
      return this.external('v1 catch-all fallback', request, request.specifier);
    } else {
      // native v2 packages don't automatically externalize *everything* the way
      // auto-upgraded packages do, but they still externalize known and approved
      // ember virtual packages (like @ember/component)
      if (emberVirtualPackages.has(packageName)) {
        return this.external('emberVirtualPackages', request, request.specifier);
      }
    }

    // this is falling through with the original specifier which was
    // non-resolvable, which will presumably cause a static build error in stage3.
    return logTransition('fallbackResolve final exit', request);
  }

  private getEntryFromMergeMap(
    inEngineSpecifier: string,
    root: string
  ): { entry: MergeEntry; matched: string } | undefined {
    let entry: MergeEntry | undefined;
    for (let candidate of this.withResolvableExtensions(inEngineSpecifier)) {
      entry = this.mergeMap.get(root)?.get(candidate);
      if (entry) {
        return { entry, matched: candidate };
      }
    }
  }

  private *withResolvableExtensions(filename: string): Generator<string, void, void> {
    if (filename.match(/\.(hbs|js|hbs\.js)$/)) {
      yield filename;
    } else {
      for (let ext of ['.js', '.hbs.js', '.hbs']) {
        yield `${filename}${ext}`;
      }
    }
  }

  private async searchAppTree<R extends ModuleRequest>(
    request: R,
    engine: EngineConfig,
    inEngineSpecifier: string
  ): Promise<R | undefined> {
    let matched = this.getEntryFromMergeMap(inEngineSpecifier, engine.root);

    switch (matched?.entry.type) {
      case undefined:
        return undefined;
      case 'app-only':
        return request.alias(matched.entry['app-js'].specifier).rehome(matched.entry['app-js'].fromFile);
      case 'fastboot-only':
        return request.alias(matched.entry['fastboot-js'].specifier).rehome(matched.entry['fastboot-js'].fromFile);
      case 'both':
        let foundAppJS = await this.resolve(
          request.alias(matched.entry['app-js'].specifier).rehome(matched.entry['app-js'].fromFile).withMeta({
            runtimeFallback: false,
          })
        );
        if (foundAppJS.type !== 'found') {
          throw new Error(
            `${matched.entry['app-js'].fromPackageName} declared ${inEngineSpecifier} in packageJSON.ember-addon.app-js, but that module does not exist`
          );
        }
        let { names } = describeExports(readFileSync(foundAppJS.filename, 'utf8'), { configFile: false });
        return request.virtualize(fastbootSwitch(matched.matched, resolve(engine.root, 'package.json'), names));
    }
  }

  // check whether the given file with the given owningPackage is an addon's
  // appTree, and if so return the notional location within the app (or owning
  // engine) that it "logically" lives at.
  private reverseSearchAppTree(
    owningPackage: Package,
    fromFile: string
  ): { owningEngine: EngineConfig; inAppName: string } | undefined {
    // if the requesting file is in an addon's app-js, the request should
    // really be understood as a request for a module in the containing engine
    if (owningPackage.isV2Addon()) {
      let sections = [owningPackage.meta['app-js'], owningPackage.meta['fastboot-js']];
      for (let section of sections) {
        if (section) {
          let fromPackageRelativePath = explicitRelative(owningPackage.root, fromFile);
          for (let [inAppName, inAddonName] of Object.entries(section)) {
            if (inAddonName === fromPackageRelativePath) {
              return { owningEngine: this.owningEngine(owningPackage), inAppName };
            }
          }
        }
      }
    }
  }

  // check if this file is resolvable as a global component, and if so return
  // its dasherized name
  reverseComponentLookup(filename: string): string | undefined {
    const owningPackage = this.packageCache.ownerOfFile(filename);
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
  if (pkg.meta['auto-upgraded'] && !pkg.hasDependency('ember-auto-import')) {
    // v1 addons without ember-auto-import cannot resolve NPM dependencies
    return false;
  }

  if (pkg.hasDependency(packageName)) {
    return true;
  }

  if (pkg.name === packageName && pkg.packageJSON.exports) {
    return true;
  }

  return false;
}

//
function appImportInAppTree(inPackage: Package, inLogicalPackage: Package, importedPackageName: string): boolean {
  return inPackage !== inLogicalPackage && importedPackageName === inLogicalPackage.name;
}
