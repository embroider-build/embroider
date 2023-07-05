import {
  emberVirtualPackages,
  emberVirtualPeerDeps,
  extensionsPattern,
  packageName as getPackageName,
  packageName,
} from '@embroider/shared-internals';
import { dirname, resolve } from 'path';
import { Package, V2Package, explicitRelative, RewrittenPackageCache } from '@embroider/shared-internals';
import makeDebug from 'debug';
import assertNever from 'assert-never';
import resolveModule from 'resolve';
import {
  virtualExternalModule,
  virtualPairComponent,
  virtualContent,
  fastbootSwitch,
  decodeFastbootSwitch,
} from './virtual-content';
import { Memoize } from 'typescript-memoize';
import { describeExports } from './describe-exports';
import { readFileSync } from 'fs';

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
  activeAddons: {
    [packageName: string]: string;
  };
  resolvableExtensions: string[];
  appRoot: string;
  engines: EngineConfig[];
  modulePrefix: string;
  podModulePrefix?: string;
}

interface EngineConfig {
  packageName: string;
  activeAddons: { name: string; root: string }[];
  fastbootFiles: { [appName: string]: { localFilename: string; shadowedFilename: string | undefined } };
  root: string;
}

type MergeEntry =
  | {
      type: 'app-only';
      'app-js': {
        localPath: string;
        packageRoot: string;
        fromPackageName: string;
      };
    }
  | {
      type: 'fastboot-only';
      'fastboot-js': {
        localPath: string;
        packageRoot: string;
        fromPackageName: string;
      };
    }
  | {
      type: 'both';
      'app-js': {
        localPath: string;
        packageRoot: string;
        fromPackageName: string;
      };
      'fastboot-js': {
        localPath: string;
        packageRoot: string;
        fromPackageName: string;
      };
    };

type MergeMap = Map</* engine root dir */ string, Map</* withinEngineModuleName */ string, MergeEntry>>;

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
    if (this.fromFile === fromFile) {
      return this;
    } else {
      return new NodeModuleRequest(this.specifier, fromFile) as this;
    }
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

    request = this.handleFastbootSwitch(request);
    request = this.handleGlobalsCompat(request);
    request = this.handleRenaming(request);
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
  // synchronous.
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

  private get packageCache() {
    return RewrittenPackageCache.shared('embroider', this.options.appRoot);
  }

  owningPackage(fromFile: string): Package | undefined {
    return this.packageCache.ownerOfFile(fromFile);
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
    let pkg = this.owningPackage(request.fromFile);

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
            let { names } = describeExports(readFileSync(resolve(pkg.root, fastbootFile.shadowedFilename), 'utf8'), {});
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

    let pkg = this.owningPackage(match.filename);
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
          request.alias(entry[section].localPath).rehome(resolve(entry[section].packageRoot, 'package.json'))
        );
      }
    }

    return logTransition('failed to match in fastboot switch', request);
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
    return logTransition(
      'resolveHelper',
      request,
      request.alias(`${target.packageName}/helpers/${target.memberName}`).rehome(resolve(inEngine.root, 'package.json'))
    );
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
      return logTransition('ambiguous case matched a helper', request, helperCandidate);
    }

    // unlike resolveHelper, resolveComponent already does pre-resolution in
    // order to deal with its own internal ambiguity around JS vs HBS vs
    // colocation.≥
    let componentMatch = this.resolveComponent(path, inEngine, request);
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
                    localPath: inAddonName,
                    packageRoot: addon.root,
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
                    localPath: inAddonName,
                    packageRoot: addon.root,
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
                    localPath: inAddonName,
                    packageRoot: addon.root,
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
                    localPath: inAddonName,
                    packageRoot: addon.root,
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
    if (request.isVirtual) {
      return request;
    }
    let requestingPkg = this.owningPackage(request.fromFile);
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
        // this is not the place to report resolution failures. If the thing
        // doesn't resolve, we're just not interested in redirecting it for
        // backward-compat, that's all. The rest of the system will take care of
        // reporting a failure to resolve (or handling it a different way)
        if (err.code !== 'MODULE_NOT_FOUND') {
          throw err;
        }
      }
    }

    let originalRequestingPkg = this.packageCache.original(requestingPkg);
    let originalTargetPkg = targetPkg ? this.packageCache.original(targetPkg) : undefined;

    if (targetPkg && originalTargetPkg) {
      // in this case it doesn't matter whether or not the requesting package
      // was moved. RewrittenPackageCache.resolve already took care of finding
      // the right target, and we redirect the request so it will look inside
      // that target.
      return logTransition('request targets a moved package', request, this.resolveWithinPackage(request, targetPkg));
    } else if (originalRequestingPkg) {
      // in this case, the requesting package is moved but its destination is
      // not, so we need to rehome the request back to the original location.
      return logTransition(
        'outbound request from moved package',
        request,
        request.rehome(resolve(originalRequestingPkg.root, request.fromFile.slice(requestingPkg.root.length + 1)))
      );
    }

    return request;
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
          request.rehome(resolve(logicalLocation.owningEngine.root, logicalLocation.inAppName))
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
      if (!this.options.activeAddons[packageName]) {
        throw new Error(`${pkg.name} is trying to import the app's ${packageName} package, but it seems to be missing`);
      }
      let newHome = resolve(
        this.packageCache.maybeMoved(this.packageCache.get(this.options.appRoot)).root,
        'package.json'
      );
      return logTransition(`emberVirtualPeerDeps in v2 addon`, request, request.rehome(newHome));
    }

    // if this file is part of an addon's app-js, it's really the logical
    // package to which it belongs (normally the app) that affects some policy
    // choices about what it can import
    let logicalPackage = this.logicalPackage(pkg, fromFile);

    if (logicalPackage.meta['auto-upgraded'] && !logicalPackage.hasDependency('ember-auto-import')) {
      try {
        let dep = this.packageCache.resolve(packageName, logicalPackage);
        if (!dep.isEmberPackage()) {
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
        !pkg.meta['auto-upgraded'] &&
        !appImportInAppTree(pkg, logicalPackage, packageName) &&
        !reliablyResolvable(pkg, packageName)
      ) {
        throw new Error(
          `${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`
        );
      }
    }
    return request;
  }

  private external<R extends ModuleRequest>(label: string, request: R, specifier: string): R {
    let exports = knownExports.get(specifier) ?? knownExports.get(specifier + '/index');
    if (!exports) {
      throw new Error(`don't know exports for external: ${specifier}`);
    }
    let filename = virtualExternalModule(specifier, exports);
    return logTransition(label, request, request.virtualize(filename));
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
    if (!pkg) {
      return logTransition('no identifiable owningPackage', request);
    }

    // if we rehomed this request to its un-rewritten location in order to try
    // to do the defaultResolve from there, now we refer back to the rewritten
    // location because that's what we want to use when asking things like
    // isV2Ember()
    let movedPkg = this.packageCache.maybeMoved(pkg);
    if (movedPkg !== pkg) {
      fromFile = resolve(movedPkg.root, request.fromFile.slice(pkg.root.length + 1));
      pkg = movedPkg;
    }

    if (!pkg.isV2Ember()) {
      return logTransition('fallbackResolve: not in an ember package', request);
    }

    let packageName = getPackageName(specifier);
    if (!packageName) {
      // this is a relative import

      let withinEngine = this.engineConfig(pkg.name);
      if (withinEngine) {
        // it's a relative import inside an engine (which also means app), which
        // means we may need to satisfy the request via app tree merging.
        let appJSMatch = this.searchAppTree(
          request,
          withinEngine,
          explicitRelative(pkg.root, resolve(dirname(fromFile), specifier))
        );
        if (appJSMatch) {
          return logTransition('fallbackResolve: relative appJsMatch', request, appJSMatch);
        } else {
          return logTransition('fallbackResolve: relative appJs search failure', request);
        }
      } else {
        if (pkg.meta['auto-upgraded'] && dirname(request.fromFile) === pkg.root) {
          let otherRoot = this.options.activeAddons[pkg.name];
          if (otherRoot && otherRoot !== pkg.root) {
            // This provides some backward-compatibility with the way things
            // would have resolved in earlier embroider versions, where the
            // final fallback was always the activeAddons. These requests now
            // end up getting converted to relative requests inside a particular
            // moved package, which is why we need to handle them here.
            //
            // TODO: We shouldn't need this if we generate notional per-package
            // entrypoints that pull in all the implicit-modules, so that the
            // imports for implicit-modules happen in places with normal
            // dependency resolvability.
            return logTransition(
              'fallbackResolve: relative path falling through to activeAddons',
              request,
              request.rehome(resolve(otherRoot, 'package.json'))
            );
          }
        }

        // nothing else to do for relative imports
        return logTransition('fallbackResolve: relative failure', request);
      }
    }

    // auto-upgraded packages can fall back to the set of known active addons
    //
    // v2 packages can fall back to the set of known active addons only to find
    // themselves (which is needed due to app tree merging)
    if ((pkg.meta['auto-upgraded'] || packageName === pkg.name) && this.options.activeAddons[packageName]) {
      return logTransition(
        `activeAddons`,
        request,
        this.resolveWithinPackage(request, this.packageCache.get(this.options.activeAddons[packageName]))
      );
    }

    let logicalLocation = this.reverseSearchAppTree(pkg, fromFile);
    if (logicalLocation) {
      // the requesting file is in an addon's appTree. We didn't succeed in
      // resolving this (non-relative) request from inside the actual addon, so
      // next try to resolve it from the corresponding logical location in the
      // app.
      return logTransition(
        'fallbackResolve: retry from logical home of app-js file',
        request,
        request.rehome(resolve(logicalLocation.owningEngine.root, logicalLocation.inAppName))
      );
    }

    let targetingEngine = this.engineConfig(packageName);
    if (targetingEngine) {
      let appJSMatch = this.searchAppTree(request, targetingEngine, specifier.replace(packageName, '.'));
      if (appJSMatch) {
        return logTransition('fallbackResolve: non-relative appJsMatch', request, appJSMatch);
      }
    }

    if (pkg.meta['auto-upgraded']) {
      // auto-upgraded packages can fall back to attempting to find dependencies at
      // runtime. Native v2 packages can only get this behavior in the
      // isExplicitlyExternal case above because they need to explicitly ask for
      // externals.
      return this.external('v1 catch-all fallback', request, specifier);
    } else {
      // native v2 packages don't automatically externalize *everything* the way
      // auto-upgraded packages do, but they still externalize known and approved
      // ember virtual packages (like @ember/component)
      if (emberVirtualPackages.has(packageName)) {
        return this.external('emberVirtualPackages', request, specifier);
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
      for (let ext of ['.hbs', '.js', '.hbs.js']) {
        yield `${filename}${ext}`;
      }
    }
  }

  private searchAppTree<R extends ModuleRequest>(
    request: R,
    engine: EngineConfig,
    inEngineSpecifier: string
  ): R | undefined {
    let matched = this.getEntryFromMergeMap(inEngineSpecifier, engine.root);

    switch (matched?.entry.type) {
      case undefined:
        return undefined;
      case 'app-only':
        return request
          .alias(matched.entry['app-js'].localPath)
          .rehome(resolve(matched.entry['app-js'].packageRoot, 'package.json'));
      case 'fastboot-only':
        return request
          .alias(matched.entry['fastboot-js'].localPath)
          .rehome(resolve(matched.entry['fastboot-js'].packageRoot, 'package.json'));
      case 'both':
        let foundAppJS = this.nodeResolve(
          matched.entry['app-js'].localPath,
          resolve(matched.entry['app-js'].packageRoot, 'package.json')
        );
        if (foundAppJS.type !== 'real') {
          throw new Error(
            `${matched.entry['app-js'].fromPackageName} declared ${inEngineSpecifier} in packageJSON.ember-addon.app-js, but that module does not exist`
          );
        }
        let { names } = describeExports(readFileSync(foundAppJS.filename, 'utf8'), {});
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

//
function appImportInAppTree(inPackage: Package, inLogicalPackage: Package, importedPackageName: string): boolean {
  return inPackage !== inLogicalPackage && importedPackageName === inLogicalPackage.name;
}

export function buildKnownExports(window) {
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.keys(window.requirejs.entries).map(moduleName => {
          try {
            let m = window.require(moduleName);
            if (!m) {
              return [undefined, undefined];
            }
            return [moduleName, Object.keys(m)];
          } catch (err) {
            const knownBad = '@ember/template-compilation/index';
            if (!knownBad.includes(moduleName)) {
              throw err;
            }
            return [undefined, undefined];
          }
        })
      ),
      null,
      2
    )
  );
}

const knownExports: Map<string, string[]> = (() => {
  let dumped = {
    '@ember/-internals/browser-environment/index': [
      'hasDOM',
      'history',
      'isChrome',
      'isFirefox',
      'location',
      'userAgent',
      'window',
    ],
    '@ember/-internals/container/index': [
      'Container',
      'INIT_FACTORY',
      'Registry',
      'getFactoryFor',
      'privatize',
      'setFactoryFor',
    ],
    '@ember/-internals/environment/index': ['ENV', 'context', 'getENV', 'getLookup', 'global', 'setLookup'],
    '@ember/-internals/error-handling/index': [
      'getDispatchOverride',
      'getOnerror',
      'onErrorTarget',
      'setDispatchOverride',
      'setOnerror',
    ],
    '@ember/-internals/glimmer/index': [
      'Component',
      'DOMChanges',
      'DOMTreeConstruction',
      'Helper',
      'Input',
      'LinkTo',
      'NodeDOMTreeConstruction',
      'OutletView',
      'Renderer',
      'RootTemplate',
      'SafeString',
      'Textarea',
      '_resetRenderers',
      'componentCapabilities',
      'escapeExpression',
      'getTemplate',
      'getTemplates',
      'hasTemplate',
      'helper',
      'htmlSafe',
      'isHTMLSafe',
      'isSerializationFirstNode',
      'modifierCapabilities',
      'renderSettled',
      'setComponentManager',
      'setTemplate',
      'setTemplates',
      'setupApplicationRegistry',
      'setupEngineRegistry',
      'template',
      'templateCacheCounters',
    ],
    '@ember/-internals/meta/index': ['Meta', 'UNDEFINED', 'counters', 'meta', 'peekMeta', 'setMeta'],
    '@ember/-internals/meta/lib/meta': ['Meta', 'UNDEFINED', 'counters', 'meta', 'peekMeta', 'setMeta'],
    '@ember/-internals/metal/index': [
      'ASYNC_OBSERVERS',
      'ComputedDescriptor',
      'ComputedProperty',
      'DEBUG_INJECTION_FUNCTIONS',
      'Libraries',
      'NAMESPACES',
      'NAMESPACES_BY_ID',
      'PROPERTY_DID_CHANGE',
      'PROXY_CONTENT',
      'SYNC_OBSERVERS',
      'TrackedDescriptor',
      '_getPath',
      '_getProp',
      '_setProp',
      'activateObserver',
      'addArrayObserver',
      'addListener',
      'addNamespace',
      'addObserver',
      'alias',
      'arrayContentDidChange',
      'arrayContentWillChange',
      'autoComputed',
      'beginPropertyChanges',
      'cached',
      'changeProperties',
      'computed',
      'createCache',
      'defineDecorator',
      'defineProperty',
      'defineValue',
      'deprecateProperty',
      'descriptorForDecorator',
      'descriptorForProperty',
      'eachProxyArrayDidChange',
      'eachProxyArrayWillChange',
      'endPropertyChanges',
      'expandProperties',
      'findNamespace',
      'findNamespaces',
      'flushAsyncObservers',
      'get',
      'getCachedValueFor',
      'getProperties',
      'getValue',
      'hasListeners',
      'hasUnknownProperty',
      'inject',
      'isClassicDecorator',
      'isComputed',
      'isConst',
      'isElementDescriptor',
      'isNamespaceSearchDisabled',
      'libraries',
      'makeComputedDecorator',
      'markObjectAsDirty',
      'nativeDescDecorator',
      'notifyPropertyChange',
      'objectAt',
      'on',
      'processAllNamespaces',
      'processNamespace',
      'removeArrayObserver',
      'removeListener',
      'removeNamespace',
      'removeObserver',
      'replace',
      'replaceInNativeArray',
      'revalidateObservers',
      'sendEvent',
      'set',
      'setClassicDecorator',
      'setNamespaceSearchDisabled',
      'setProperties',
      'setUnprocessedMixins',
      'tagForObject',
      'tagForProperty',
      'tracked',
      'trySet',
    ],
    '@ember/-internals/overrides/index': ['onEmberGlobalAccess'],
    '@ember/-internals/owner/index': ['getOwner', 'isFactory', 'setOwner'],
    '@ember/-internals/routing/index': [
      'RouterDSL',
      'controllerFor',
      'generateController',
      'generateControllerFactory',
    ],
    '@ember/-internals/runtime/index': [
      'ActionHandler',
      'Comparable',
      'ContainerProxyMixin',
      'MutableEnumerable',
      'RSVP',
      'RegistryProxyMixin',
      'TargetActionSupport',
      '_ProxyMixin',
      '_contentFor',
      'onerrorDefault',
    ],
    '@ember/-internals/runtime/lib/ext/rsvp': ['default', 'onerrorDefault'],
    '@ember/-internals/runtime/lib/mixins/-proxy': ['contentFor', 'default'],
    '@ember/-internals/runtime/lib/mixins/action_handler': ['default'],
    '@ember/-internals/runtime/lib/mixins/comparable': ['default'],
    '@ember/-internals/runtime/lib/mixins/container_proxy': ['default'],
    '@ember/-internals/runtime/lib/mixins/registry_proxy': ['default'],
    '@ember/-internals/runtime/lib/mixins/target_action_support': ['default'],
    '@ember/-internals/string/index': ['classify', 'dasherize'],
    '@ember/-internals/utility-types/index': [],
    '@ember/-internals/utils/index': [
      'Cache',
      'GUID_KEY',
      'ROOT',
      'canInvoke',
      'checkHasSuper',
      'dictionary',
      'enumerableSymbol',
      'generateGuid',
      'getDebugName',
      'getName',
      'guidFor',
      'intern',
      'isInternalSymbol',
      'isObject',
      'isProxy',
      'lookupDescriptor',
      'observerListenerMetaFor',
      'setListeners',
      'setName',
      'setObservers',
      'setProxy',
      'setWithMandatorySetter',
      'setupMandatorySetter',
      'symbol',
      'teardownMandatorySetter',
      'toString',
      'uuid',
      'wrap',
    ],
    '@ember/-internals/views/index': [
      'ActionManager',
      'ActionSupport',
      'ChildViewsSupport',
      'ClassNamesSupport',
      'ComponentLookup',
      'CoreView',
      'EventDispatcher',
      'MUTABLE_CELL',
      'ViewMixin',
      'ViewStateSupport',
      'addChildView',
      'clearElementView',
      'clearViewElement',
      'constructStyleDeprecationMessage',
      'getChildViews',
      'getElementView',
      'getRootViews',
      'getViewBoundingClientRect',
      'getViewBounds',
      'getViewClientRects',
      'getViewElement',
      'getViewId',
      'isSimpleClick',
      'setElementView',
      'setViewElement',
    ],
    '@ember/-internals/views/lib/compat/attrs': ['MUTABLE_CELL'],
    '@ember/-internals/views/lib/compat/fallback-view-registry': ['default'],
    '@ember/-internals/views/lib/component_lookup': ['default'],
    '@ember/-internals/views/lib/mixins/action_support': ['default'],
    '@ember/-internals/views/lib/mixins/child_views_support': ['default'],
    '@ember/-internals/views/lib/mixins/class_names_support': ['default'],
    '@ember/-internals/views/lib/mixins/view_state_support': ['default'],
    '@ember/-internals/views/lib/mixins/view_support': ['default'],
    '@ember/-internals/views/lib/system/action_manager': ['default'],
    '@ember/-internals/views/lib/system/event_dispatcher': ['default'],
    '@ember/-internals/views/lib/system/utils': [
      'addChildView',
      'clearElementView',
      'clearViewElement',
      'collectChildViews',
      'constructStyleDeprecationMessage',
      'contains',
      'elMatches',
      'getChildViews',
      'getElementView',
      'getRootViews',
      'getViewBoundingClientRect',
      'getViewBounds',
      'getViewClientRects',
      'getViewElement',
      'getViewId',
      'getViewRange',
      'initChildViews',
      'isSimpleClick',
      'matches',
      'setElementView',
      'setViewElement',
    ],
    '@ember/-internals/views/lib/views/core_view': ['default'],
    '@ember/-internals/views/lib/views/states': ['default'],
    '@ember/application/index': ['_loaded', 'default', 'getOwner', 'onLoad', 'runLoadHooks', 'setOwner'],
    '@ember/application/instance': ['default'],
    '@ember/application/lib/lazy_load': ['_loaded', 'onLoad', 'runLoadHooks'],
    '@ember/application/namespace': ['default'],
    '@ember/array/-internals': ['isEmberArray', 'setEmberArray'],
    '@ember/array/index': ['A', 'MutableArray', 'NativeArray', 'default', 'isArray', 'makeArray', 'removeAt', 'uniqBy'],
    '@ember/array/lib/make-array': ['default'],
    '@ember/array/mutable': ['default'],
    '@ember/array/proxy': ['default'],
    '@ember/canary-features/index': ['DEFAULT_FEATURES', 'FEATURES', 'isEnabled'],
    '@ember/component/helper': ['default', 'helper'],
    '@ember/component/index': [
      'Input',
      'Textarea',
      'capabilities',
      'default',
      'getComponentTemplate',
      'setComponentManager',
      'setComponentTemplate',
    ],
    '@ember/component/template-only': ['default'],
    '@ember/controller/index': ['ControllerMixin', 'default', 'inject'],
    '@ember/debug/container-debug-adapter': ['default'],
    '@ember/debug/data-adapter': ['default'],
    '@ember/debug/index': [
      '_warnIfUsingStrippedFeatureFlags',
      'assert',
      'captureRenderTree',
      'debug',
      'debugFreeze',
      'debugSeal',
      'deprecate',
      'deprecateFunc',
      'getDebugFunction',
      'info',
      'inspect',
      'isTesting',
      'registerDeprecationHandler',
      'registerWarnHandler',
      'runInDebug',
      'setDebugFunction',
      'setTesting',
      'warn',
    ],
    '@ember/debug/lib/capture-render-tree': ['default'],
    '@ember/debug/lib/deprecate': [
      'default',
      'missingOptionDeprecation',
      'missingOptionsDeprecation',
      'missingOptionsIdDeprecation',
      'registerHandler',
    ],
    '@ember/debug/lib/handlers': ['HANDLERS', 'invoke', 'registerHandler'],
    '@ember/debug/lib/inspect': ['default'],
    '@ember/debug/lib/testing': ['isTesting', 'setTesting'],
    '@ember/debug/lib/warn': ['default', 'missingOptionsDeprecation', 'missingOptionsIdDeprecation', 'registerHandler'],
    '@ember/deprecated-features/index': ['ASSIGN'],
    '@ember/destroyable/index': [
      'assertDestroyablesDestroyed',
      'associateDestroyableChild',
      'destroy',
      'enableDestroyableTracking',
      'isDestroyed',
      'isDestroying',
      'registerDestructor',
      'unregisterDestructor',
    ],
    '@ember/engine/index': ['buildInitializerMethod', 'default', 'getEngineParent', 'setEngineParent'],
    '@ember/engine/instance': ['default'],
    '@ember/engine/lib/engine-parent': ['ENGINE_PARENT', 'getEngineParent', 'setEngineParent'],
    '@ember/enumerable/index': ['default'],
    '@ember/enumerable/mutable': ['default'],
    '@ember/helper/index': ['array', 'capabilities', 'concat', 'fn', 'get', 'hash', 'invokeHelper', 'setHelperManager'],
    '@ember/instrumentation/index': [
      '_instrumentStart',
      'flaggedInstrument',
      'instrument',
      'reset',
      'subscribe',
      'subscribers',
      'unsubscribe',
    ],
    '@ember/modifier/index': ['capabilities', 'on', 'setModifierManager'],
    '@ember/object/-internals': ['FrameworkObject', 'cacheFor', 'guidFor'],
    '@ember/object/compat': ['dependentKeyCompat'],
    '@ember/object/computed': [
      'alias',
      'and',
      'bool',
      'collect',
      'default',
      'deprecatingAlias',
      'empty',
      'equal',
      'expandProperties',
      'filter',
      'filterBy',
      'gt',
      'gte',
      'intersect',
      'lt',
      'lte',
      'map',
      'mapBy',
      'match',
      'max',
      'min',
      'none',
      'not',
      'notEmpty',
      'oneWay',
      'or',
      'readOnly',
      'reads',
      'setDiff',
      'sort',
      'sum',
      'union',
      'uniq',
      'uniqBy',
    ],
    '@ember/object/core': ['default'],
    '@ember/object/evented': ['default', 'on'],
    '@ember/object/events': ['addListener', 'removeListener', 'sendEvent'],
    '@ember/object/index': [
      'action',
      'computed',
      'default',
      'defineProperty',
      'get',
      'getProperties',
      'notifyPropertyChange',
      'observer',
      'set',
      'setProperties',
      'trySet',
    ],
    '@ember/object/internals': ['cacheFor', 'guidFor'],
    '@ember/object/lib/computed/computed_macros': [
      'and',
      'bool',
      'deprecatingAlias',
      'empty',
      'equal',
      'gt',
      'gte',
      'lt',
      'lte',
      'match',
      'none',
      'not',
      'notEmpty',
      'oneWay',
      'or',
      'readOnly',
    ],
    '@ember/object/lib/computed/reduce_computed_macros': [
      'collect',
      'filter',
      'filterBy',
      'intersect',
      'map',
      'mapBy',
      'max',
      'min',
      'setDiff',
      'sort',
      'sum',
      'union',
      'uniq',
      'uniqBy',
    ],
    '@ember/object/mixin': ['applyMixin', 'default', 'mixin'],
    '@ember/object/observable': ['default'],
    '@ember/object/observers': ['addObserver', 'removeObserver'],
    '@ember/object/promise-proxy-mixin': ['default'],
    '@ember/object/proxy': ['default'],
    '@ember/owner/index': ['getOwner', 'setOwner'],
    '@ember/renderer/index': ['renderSettled'],
    '@ember/routing/-internals': [
      'BucketCache',
      'DSL',
      'RouterState',
      'RoutingService',
      'controllerFor',
      'generateController',
      'generateControllerFactory',
      'prefixRouteNameArg',
    ],
    '@ember/routing/hash-location': ['default'],
    '@ember/routing/history-location': ['default'],
    '@ember/routing/index': ['LinkTo'],
    '@ember/routing/lib/cache': ['default'],
    '@ember/routing/lib/controller_for': ['default'],
    '@ember/routing/lib/dsl': ['default'],
    '@ember/routing/lib/engines': [],
    '@ember/routing/lib/generate_controller': ['default', 'generateControllerFactory'],
    '@ember/routing/lib/location-utils': ['getFullPath', 'getHash', 'getOrigin', 'getPath', 'getQuery', 'replacePath'],
    '@ember/routing/lib/query_params': ['default'],
    '@ember/routing/lib/route-info': [],
    '@ember/routing/lib/router_state': ['default'],
    '@ember/routing/lib/routing-service': ['default'],
    '@ember/routing/lib/utils': [
      'calculateCacheKey',
      'extractRouteArgs',
      'getActiveTargetName',
      'normalizeControllerQueryParams',
      'prefixRouteNameArg',
      'resemblesURL',
      'shallowEqual',
      'stashParamNames',
    ],
    '@ember/routing/location': [],
    '@ember/routing/none-location': ['default'],
    '@ember/routing/route-info': [],
    '@ember/routing/route': [
      'ROUTE_CONNECTIONS',
      'default',
      'defaultSerialize',
      'getFullQueryParams',
      'hasDefaultSerialize',
    ],
    '@ember/routing/router-service': ['ROUTER', 'default'],
    '@ember/routing/router': ['default', 'triggerEvent'],
    '@ember/routing/transition': [],
    '@ember/runloop/index': [
      '_backburner',
      '_cancelTimers',
      '_getCurrentRunLoop',
      '_hasScheduledTimers',
      '_queues',
      '_rsvpErrorQueue',
      'begin',
      'bind',
      'cancel',
      'debounce',
      'end',
      'join',
      'later',
      'next',
      'once',
      'run',
      'schedule',
      'scheduleOnce',
      'throttle',
    ],
    '@ember/service/index': ['default', 'inject', 'service'],
    '@ember/template-factory/index': ['createTemplateFactory'],
    '@ember/template/index': ['htmlSafe', 'isHTMLSafe'],
    '@ember/test/adapter': ['default'],
    '@ember/test/index': [
      'registerAsyncHelper',
      'registerHelper',
      'registerWaiter',
      'unregisterHelper',
      'unregisterWaiter',
    ],
    '@ember/utils/index': ['compare', 'isBlank', 'isEmpty', 'isEqual', 'isNone', 'isPresent', 'typeOf'],
    '@ember/utils/lib/compare': ['default'],
    '@ember/utils/lib/is-equal': ['default'],
    '@ember/utils/lib/is_blank': ['default'],
    '@ember/utils/lib/is_empty': ['default'],
    '@ember/utils/lib/is_none': ['default'],
    '@ember/utils/lib/is_present': ['default'],
    '@ember/utils/lib/type-of': ['default'],
    '@ember/version/index': ['VERSION'],
    '@glimmer/destroyable': [
      '_hasDestroyableChildren',
      'assertDestroyablesDestroyed',
      'associateDestroyableChild',
      'destroy',
      'destroyChildren',
      'enableDestroyableTracking',
      'isDestroyed',
      'isDestroying',
      'registerDestructor',
      'unregisterDestructor',
    ],
    '@glimmer/encoder': ['InstructionEncoderImpl'],
    '@glimmer/env': ['CI', 'DEBUG'],
    '@glimmer/global-context': [
      'FEATURE_DEFAULT_HELPER_MANAGER',
      'assert',
      'assertGlobalContextWasSet',
      'default',
      'deprecate',
      'getPath',
      'getProp',
      'scheduleDestroy',
      'scheduleDestroyed',
      'scheduleRevalidate',
      'setPath',
      'setProp',
      'testOverrideGlobalContext',
      'toBool',
      'toIterator',
      'warnIfStyleNotTrusted',
    ],
    '@glimmer/low-level': ['Stack', 'Storage'],
    '@glimmer/manager': [
      'CustomComponentManager',
      'CustomHelperManager',
      'CustomModifierManager',
      'capabilityFlagsFrom',
      'componentCapabilities',
      'getComponentTemplate',
      'getCustomTagFor',
      'getInternalComponentManager',
      'getInternalHelperManager',
      'getInternalModifierManager',
      'hasCapability',
      'hasDestroyable',
      'hasInternalComponentManager',
      'hasInternalHelperManager',
      'hasInternalModifierManager',
      'hasValue',
      'helperCapabilities',
      'managerHasCapability',
      'modifierCapabilities',
      'setComponentManager',
      'setComponentTemplate',
      'setCustomTagFor',
      'setHelperManager',
      'setInternalComponentManager',
      'setInternalHelperManager',
      'setInternalModifierManager',
      'setModifierManager',
    ],
    '@glimmer/node': ['NodeDOMTreeConstruction', 'serializeBuilder'],
    '@glimmer/opcode-compiler': [
      'CompileTimeCompilationContextImpl',
      'DEFAULT_CAPABILITIES',
      'EMPTY_BLOCKS',
      'MINIMAL_CAPABILITIES',
      'StdLib',
      'WrappedBuilder',
      'compilable',
      'compileStatements',
      'compileStd',
      'debugCompiler',
      'invokeStaticBlock',
      'invokeStaticBlockWithStack',
      'meta',
      'programCompilationContext',
      'templateCacheCounters',
      'templateCompilationContext',
      'templateFactory',
    ],
    '@glimmer/owner': ['OWNER', 'getOwner', 'setOwner'],
    '@glimmer/program': [
      'CompileTimeConstantImpl',
      'ConstantsImpl',
      'HeapImpl',
      'RuntimeConstantsImpl',
      'RuntimeHeapImpl',
      'RuntimeOpImpl',
      'RuntimeProgramImpl',
      'artifacts',
      'hydrateHeap',
    ],
    '@glimmer/reference': [
      'FALSE_REFERENCE',
      'NULL_REFERENCE',
      'REFERENCE',
      'TRUE_REFERENCE',
      'UNDEFINED_REFERENCE',
      'childRefFor',
      'childRefFromParts',
      'createComputeRef',
      'createConstRef',
      'createDebugAliasRef',
      'createInvokableRef',
      'createIteratorItemRef',
      'createIteratorRef',
      'createPrimitiveRef',
      'createReadOnlyRef',
      'createUnboundRef',
      'isConstRef',
      'isInvokableRef',
      'isUpdatableRef',
      'updateRef',
      'valueForRef',
    ],
    '@glimmer/runtime': [
      'ConcreteBounds',
      'CurriedValue',
      'CursorImpl',
      'DOMChanges',
      'DOMTreeConstruction',
      'DynamicAttribute',
      'DynamicScopeImpl',
      'EMPTY_ARGS',
      'EMPTY_NAMED',
      'EMPTY_POSITIONAL',
      'EnvironmentImpl',
      'IDOMChanges',
      'LowLevelVM',
      'NewElementBuilder',
      'PartialScopeImpl',
      'RehydrateBuilder',
      'RemoteLiveBlock',
      'SERIALIZATION_FIRST_NODE_STRING',
      'SimpleDynamicAttribute',
      'TEMPLATE_ONLY_COMPONENT_MANAGER',
      'TemplateOnlyComponent',
      'TemplateOnlyComponentManager',
      'UpdatableBlockImpl',
      'UpdatingVM',
      'array',
      'clear',
      'clientBuilder',
      'concat',
      'createCapturedArgs',
      'curry',
      'destroy',
      'dynamicAttribute',
      'fn',
      'get',
      'hash',
      'inTransaction',
      'invokeHelper',
      'isDestroyed',
      'isDestroying',
      'isSerializationFirstNode',
      'isWhitespace',
      'normalizeProperty',
      'on',
      'registerDestructor',
      'rehydrationBuilder',
      'reifyArgs',
      'reifyNamed',
      'reifyPositional',
      'renderComponent',
      'renderMain',
      'renderSync',
      'resetDebuggerCallback',
      'runtimeContext',
      'setDebuggerCallback',
      'templateOnlyComponent',
    ],
    '@glimmer/tracking/index': ['cached', 'tracked'],
    '@glimmer/tracking/primitives/cache': ['createCache', 'getValue', 'isConst'],
    '@glimmer/util': [
      'EMPTY_ARRAY',
      'EMPTY_NUMBER_ARRAY',
      'EMPTY_STRING_ARRAY',
      'HAS_NATIVE_PROXY',
      'HAS_NATIVE_SYMBOL',
      'LOCAL_LOGGER',
      'LOGGER',
      'SERIALIZATION_FIRST_NODE_STRING',
      'Stack',
      '_WeakSet',
      'assert',
      'assertNever',
      'assertPresent',
      'assign',
      'beginTestSteps',
      'buildUntouchableThis',
      'castToBrowser',
      'castToSimple',
      'checkNode',
      'clearElement',
      'constants',
      'debugToString',
      'decodeHandle',
      'decodeImmediate',
      'decodeNegative',
      'decodePositive',
      'deprecate',
      'dict',
      'emptyArray',
      'encodeHandle',
      'encodeImmediate',
      'encodeNegative',
      'encodePositive',
      'endTestSteps',
      'enumerableSymbol',
      'exhausted',
      'expect',
      'extractHandle',
      'fillNulls',
      'ifPresent',
      'intern',
      'isDict',
      'isEmptyArray',
      'isErrHandle',
      'isHandle',
      'isNonPrimitiveHandle',
      'isObject',
      'isOkHandle',
      'isPresent',
      'isSerializationFirstNode',
      'isSmallInt',
      'keys',
      'logStep',
      'mapPresent',
      'strip',
      'symbol',
      'toPresentOption',
      'tuple',
      'unreachable',
      'unwrap',
      'unwrapHandle',
      'unwrapTemplate',
      'values',
      'verifySteps',
    ],
    '@glimmer/validator': [
      'ALLOW_CYCLES',
      'COMPUTE',
      'CONSTANT',
      'CONSTANT_TAG',
      'CURRENT_TAG',
      'CurrentTag',
      'INITIAL',
      'VOLATILE',
      'VOLATILE_TAG',
      'VolatileTag',
      'beginTrackFrame',
      'beginTrackingTransaction',
      'beginUntrackFrame',
      'bump',
      'combine',
      'consumeTag',
      'createCache',
      'createTag',
      'createUpdatableTag',
      'dirtyTag',
      'dirtyTagFor',
      'endTrackFrame',
      'endTrackingTransaction',
      'endUntrackFrame',
      'getValue',
      'isConst',
      'isConstTag',
      'isTracking',
      'logTrackingStack',
      'resetTracking',
      'runInTrackingTransaction',
      'setTrackingTransactionEnv',
      'tagFor',
      'tagMetaFor',
      'track',
      'trackedData',
      'untrack',
      'updateTag',
      'validateTag',
      'valueForTag',
    ],
    '@glimmer/vm': [
      '$fp',
      '$pc',
      '$ra',
      '$s0',
      '$s1',
      '$sp',
      '$t0',
      '$t1',
      '$v0',
      'SavedRegister',
      'TemporaryRegister',
      'isLowLevelRegister',
      'isMachineOp',
      'isOp',
    ],
    '@glimmer/wire-format': [
      'getStringFromValue',
      'is',
      'isArgument',
      'isAttribute',
      'isFlushElement',
      'isGet',
      'isHelper',
      'isStringLiteral',
    ],
    '@simple-dom/document': ['default'],
    backburner: ['buildPlatform', 'default'],
    'dag-map': ['default'],
    'ember-babel': [
      'assertThisInitialized',
      'classCallCheck',
      'createClass',
      'createForOfIteratorHelperLoose',
      'createSuper',
      'inheritsLoose',
      'objectDestructuringEmpty',
      'possibleConstructorReturn',
      'taggedTemplateLiteralLoose',
      'wrapNativeSuper',
    ],
    'ember-testing/index': ['Adapter', 'QUnitAdapter', 'Test', 'setupForTesting'],
    'ember-testing/lib/adapters/adapter': ['default'],
    'ember-testing/lib/adapters/qunit': ['default'],
    'ember-testing/lib/ext/rsvp': ['default'],
    'ember-testing/lib/helpers/and_then': ['default'],
    'ember-testing/lib/helpers/current_path': ['default'],
    'ember-testing/lib/helpers/current_route_name': ['default'],
    'ember-testing/lib/helpers/current_url': ['default'],
    'ember-testing/lib/helpers/pause_test': ['pauseTest', 'resumeTest'],
    'ember-testing/lib/helpers/visit': ['default'],
    'ember-testing/lib/helpers/wait': ['default'],
    'ember-testing/lib/setup_for_testing': ['default'],
    'ember-testing/lib/test': ['default'],
    'ember-testing/lib/test/adapter': ['asyncEnd', 'asyncStart', 'getAdapter', 'setAdapter'],
    'ember-testing/lib/test/helpers': ['helpers', 'registerAsyncHelper', 'registerHelper', 'unregisterHelper'],
    'ember-testing/lib/test/on_inject_helpers': ['callbacks', 'invokeInjectHelpersCallbacks', 'onInjectHelpers'],
    'ember-testing/lib/test/pending_requests': [
      'clearPendingRequests',
      'decrementPendingRequests',
      'incrementPendingRequests',
      'pendingRequests',
    ],
    'ember-testing/lib/test/promise': ['default', 'getLastPromise', 'promise', 'resolve'],
    'ember-testing/lib/test/run': ['default'],
    'ember-testing/lib/test/waiters': ['checkWaiters', 'registerWaiter', 'unregisterWaiter'],
    'ember/index': ['default'],
    'ember/version': ['default'],
    'route-recognizer': ['default'],
    router_js: [
      'InternalRouteInfo',
      'InternalTransition',
      'PARAMS_SYMBOL',
      'QUERY_PARAMS_SYMBOL',
      'STATE_SYMBOL',
      'TransitionError',
      'TransitionState',
      'default',
      'logAbort',
    ],
    rsvp: [
      'EventTarget',
      'Promise',
      'all',
      'allSettled',
      'asap',
      'async',
      'cast',
      'configure',
      'default',
      'defer',
      'denodeify',
      'filter',
      'hash',
      'hashSettled',
      'map',
      'off',
      'on',
      'race',
      'reject',
      'resolve',
      'rethrow',
    ],
    fetch: ['AbortController', 'AbortSignal', 'fetch', 'Headers', 'Request', 'Response', 'default'],
    'vite-app/app': ['default'],
  };

  let m = new Map(Object.entries(dumped));
  m.set('require', []);
  return m;
})();
