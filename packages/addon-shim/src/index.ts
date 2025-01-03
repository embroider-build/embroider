import {
  AddonInstance,
  AddonMeta,
  PackageInfo,
  isDeepAddonInstance,
} from '@embroider/shared-internals';
import buildFunnel from 'broccoli-funnel';
import commonAncestorPath from 'common-ancestor-path';
import { readFileSync } from 'fs';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'path';
import { satisfies } from 'semver';

export interface ShimOptions {
  disabled?: (options: any) => boolean;

  // this part only applies when running under ember-auto-import. It's intended
  // to let a V2 addon tweak how it's interpreted by ember-auto-import inside
  // the classic build in order to achieve backward compatibility with how it
  // behaved as a V1 addon.
  autoImportCompat?: {
    // can modify the `ember-addon` metadata that ember-auto-import is using to
    // do resolution. Right now that means the `renamed-modules`.
    customizeMeta?: (meta: AddonMeta) => AddonMeta;
  };
}

function addonMeta(pkgJSON: PackageInfo): AddonMeta {
  let meta = pkgJSON['ember-addon'];
  if (meta?.version !== 2) {
    throw new Error(`did not find valid v2 addon metadata in ${pkgJSON.name}`);
  }
  return meta as AddonMeta;
}

type OwnType = AddonInstance & {
  _eaiAssertions(): void;
  _internalRegisterV2Addon(
    name: string,
    root: string,
    autoImportCompat?: ShimOptions['autoImportCompat']
  ): void;
  _parentName(): string;
};

export function addonV1Shim(directory: string, options: ShimOptions = {}) {
  let pkg: PackageInfo = JSON.parse(
    readFileSync(resolve(directory, './package.json'), 'utf8')
  );

  let meta = addonMeta(pkg);
  let disabled = false;

  function treeFor(
    addonInstance: AddonInstance,
    resourceMap: Record<string, string>,
    // default expectation is for resourceMap to map from interior to exterior, swap if needed
    swapInteriorExterior = false
  ) {
    const absoluteInteriorPaths = Object[
      swapInteriorExterior ? 'values' : 'keys'
    ](resourceMap).map((internalPath) => join(directory, internalPath));

    if (absoluteInteriorPaths.length === 0) {
      return;
    }

    const ancestorPath =
      commonAncestorPath(...absoluteInteriorPaths.map(dirname)) ?? directory;
    const ancestorPathRel = relative(directory, ancestorPath);
    const ancestorTree = addonInstance.treeGenerator(ancestorPath);
    const relativeInteriorPaths = absoluteInteriorPaths.map((absPath) =>
      relative(ancestorPath, absPath)
    );

    return buildFunnel(ancestorTree, {
      files: relativeInteriorPaths,
      getDestinationPath(relativePath: string): string {
        for (let [a, b] of Object.entries(resourceMap)) {
          const interiorName = swapInteriorExterior ? b : a;
          const exteriorName = swapInteriorExterior ? a : b;
          if (join(ancestorPathRel, relativePath) === normalize(interiorName)) {
            return exteriorName;
          }
        }
        throw new Error(
          `bug in addonV1Shim, no match for ${relativePath} in ${JSON.stringify(
            resourceMap
          )}`
        );
      },
    });
  }

  return {
    name: pkg.name,
    included(this: OwnType, ...args: unknown[]) {
      let parentOptions;
      if (isDeepAddonInstance(this)) {
        parentOptions = this.parent.options;
      } else {
        parentOptions = this.app.options;
      }

      this._eaiAssertions();
      this._internalRegisterV2Addon(
        this.name,
        directory,
        options.autoImportCompat
      );

      if (options.disabled) {
        disabled = options.disabled(parentOptions);
      }

      // this is at the end so we can find our own autoImportInstance before any
      // deeper v2 addons ask us to forward registrations upward to it
      this._super.included.apply(this, args);
    },

    treeForApp(this: AddonInstance) {
      if (disabled) {
        return undefined;
      }
      let maybeAppJS = meta['app-js'];
      if (maybeAppJS) {
        return treeFor(this, maybeAppJS, true);
      }
    },

    treeForAddon() {
      // this never goes through broccoli -- it's always pulled into the app via
      // ember-auto-import, as needed. This means it always benefits from
      // tree-shaking.
      return undefined;
    },

    treeForPublic(this: AddonInstance) {
      if (disabled) {
        return undefined;
      }
      let maybeAssets = meta['public-assets'];
      if (maybeAssets) {
        return treeFor(this, maybeAssets);
      }
    },

    cacheKeyForTree(this: AddonInstance, treeType: string): string {
      return `embroider-addon-shim/${treeType}/${directory}`;
    },

    isDevelopingAddon(this: AddonInstance) {
      // if the app is inside our own directory, we must be under development.
      // This setting controls whether ember-cli will watch for changes in the
      // broccoli trees we expose, but it doesn't have any control over our
      // files that get auto-imported into the app. For that, you should use
      // ember-auto-import's watchDependencies option (and this should become
      // part of the blueprint for test apps).
      let appInstance = this._findHost();
      return isInside(directory, appInstance.project.root);
    },

    _eaiAssertions(this: OwnType) {
      // if we're being used by a v1 package, that package needs ember-auto-import 2
      if ((this.parent.pkg['ember-addon']?.version ?? 1) < 2) {
        // important: here we're talking about the version of ember-auto-import
        // declared by the package that is trying to use our V2 addon. Which is
        // distinct from the version that may be installed in the top-level app,
        // and which is also distinct from the elected ember-auto-import leader.
        let autoImport = locateAutoImport(this.parent.addons);
        if (!autoImport.present) {
          throw new Error(
            `${this._parentName()} needs to depend on ember-auto-import in order to use ${
              this.name
            }`
          );
        }
        if (!autoImport.satisfiesV2) {
          throw new Error(
            `${this._parentName()} has ember-auto-import ${
              autoImport.version
            } which is not new enough to use ${
              this.name
            }. It needs to upgrade to >=2.0`
          );
        }
      }
    },

    _internalRegisterV2Addon(
      this: OwnType,
      name: string,
      root: string,
      options?: ShimOptions['autoImportCompat']
    ) {
      // this is searching the top-level app for ember-auto-import, which is
      // different from how we searched above in _eaiAssertions. We're going
      // straight to the top because we definitely want to locate EAI if it's
      // present, but our addon's immediate parent won't necessarily have EAI if
      // that parent is itself a V2 addon.
      let autoImport = locateAutoImport(this.project.addons);
      if (!autoImport.present || !autoImport.satisfiesV2) {
        // We don't assert here because it's not our responsibility. In
        // _eaiAssertions we check the condition of our immediate parent, which
        // makes the error messages more actionable. If our parent has EAI>=2,
        // its copy of EAI will in turn assert that the app has one as well.
        //
        // This case is actually fine for a v2 app under Embroider, where EAI is
        // not needed.
        return;
      }

      // we're not using autoImport.instance.registerV2Addon because not all 2.x
      // versions will forward the third argument to the current leader. Whereas
      // we can confidently ensure that the leader itself supports the third
      // argument by adding it as a dependency of our V2 addon, since the newest
      // copy that satisfies the app's requested semver range will win the
      // election.

      let leader: ReturnType<NonNullable<EAI2Instance['leader']>>;
      if (autoImport.instance.leader) {
        // sufficiently new EAI lets us directly ask for the leader
        leader = autoImport.instance.leader();
      } else {
        // otherwise we need to reach inside
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        let AutoImport = require(join(
          autoImport.instance.root,
          'auto-import.js'
        )).default;
        leader = AutoImport.lookup(autoImport.instance);
      }

      leader.registerV2Addon(name, root, options);
    },

    _parentName(this: OwnType): string {
      if (isDeepAddonInstance(this)) {
        return this.parent.name;
      } else {
        return this.parent.name();
      }
    },

    // This continues to exist because there are earlier versions of addon-shim
    // that forward v2 addon registration through their parent V2 addon, thus
    // calling this method.
    registerV2Addon(this: OwnType, name: string, root: string): void {
      this._internalRegisterV2Addon(name, root);
    },
  };
}

function isInside(parentDir: string, otherDir: string): boolean {
  let rel = relative(parentDir, otherDir);
  return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}

type EAI2Instance = AddonInstance & {
  // all 2.x versions of EAI have this method
  registerV2Addon(name: string, root: string): void;

  // EAI >= 2.10.0 offers this API, which is intended to be more extensible
  // since it lets you talk directly to the current leader. That's better
  // because the newest version of EAI present becomes the leader, so you can
  // guarantee a minimum leader version by making it your own dependency.
  leader?: () => {
    registerV2Addon(
      name: string,
      root: string,
      options?: ShimOptions['autoImportCompat']
    ): void;
  };
};

function locateAutoImport(addons: AddonInstance[]):
  | { present: false }
  | {
      present: true;
      version: string;
      satisfiesV2: false;
    }
  | {
      present: true;
      version: string;
      satisfiesV2: true;
      instance: EAI2Instance;
    } {
  let instance = addons.find((a) => a.name === 'ember-auto-import');
  if (!instance) {
    return { present: false };
  }
  let version = instance.pkg.version;
  let satisfiesV2 = satisfies(version, '>=2.0.0-alpha.0', {
    includePrerelease: true,
  });
  if (satisfiesV2) {
    return {
      present: true,
      version,
      satisfiesV2,
      instance: instance as EAI2Instance,
    };
  } else {
    return {
      present: true,
      version,
      satisfiesV2,
    };
  }
}
