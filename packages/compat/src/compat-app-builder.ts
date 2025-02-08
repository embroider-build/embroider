import type { AddonPackage } from '@embroider/core';
import { locateEmbroiderWorkingDir } from '@embroider/core';
import type { CompatResolverOptions } from './resolver-transform';
import type { PackageRules } from './dependency-rules';
import { activePackageRules } from './dependency-rules';
import { outputJSONSync, writeFileSync } from 'fs-extra';
import type { PortableHint } from '@embroider/core/src/portable';
import { maybeNodeModuleVersion, Portable } from '@embroider/core/src/portable';
import { Memoize } from 'typescript-memoize';
import { join, dirname } from 'path';
import resolve from 'resolve';
import type ContentForConfig from './content-for-config';
import type { V1Config } from './v1-config';
import type { Package } from '@embroider/core';
import { readdirSync } from 'fs-extra';

import type CompatApp from './compat-app';
import type { CompatBabelState } from './babel';
import { MacrosConfig } from '@embroider/macros/src/node';
import { buildResolverOptions } from '@embroider/core/src/module-resolver-options';
import type { CompatOptionsType } from './options';

// This exists during the actual broccoli build step. As opposed to CompatApp,
// which also exists during pipeline-construction time.

export class CompatAppBuilder {
  constructor(
    private origAppPackage: Package,
    private appPackageWithMovedDeps: Package,
    private options: CompatOptionsType,
    private compatApp: CompatApp,
    private configTree: V1Config,
    private contentForTree: ContentForConfig,
    private synthVendor: Package,
    private synthStyles: Package
  ) {}

  private modulePrefix(): string {
    return this.configTree.readConfig().modulePrefix;
  }

  private podModulePrefix(): string | undefined {
    return this.configTree.readConfig().podModulePrefix;
  }

  @Memoize()
  private get resolverConfig(): CompatResolverOptions {
    return buildResolverOptions({
      appPackage: this.appPackageWithMovedDeps,
      modulePrefix: this.modulePrefix(),
      podModulePrefix: this.podModulePrefix(),
      splitAtRoutes: this.options.splitAtRoutes,
      staticAppPaths: this.options.staticAppPaths,
      extraDeps: new Map([[this.appPackageWithMovedDeps.root, [this.synthVendor, this.synthStyles] as AddonPackage[]]]),
      extend: (options: CompatResolverOptions, allActiveAddons) => {
        options.activePackageRules = activePackageRules(this.options.packageRules.concat(defaultAddonPackageRules()), [
          { name: this.origAppPackage.name, version: this.origAppPackage.version, root: this.origAppPackage.root },
          ...allActiveAddons.filter(p => p.meta['auto-upgraded']),
        ]);
        options.options = {
          staticInvokables: this.options.staticInvokables,
          allowUnsafeDynamicComponents: this.options.allowUnsafeDynamicComponents,
        };
        return options;
      },
    });
  }

  async build() {
    // on the first build, we lock down the macros config. on subsequent builds,
    // this doesn't do anything anyway because it's idempotent.
    this.compatApp.macrosConfig.finalize();

    let resolverConfig = this.resolverConfig;
    let config = this.configTree.readConfig();
    let contentForConfig = this.contentForTree.readContents();

    this.addResolverConfig(resolverConfig);
    this.addContentForConfig(contentForConfig);
    this.addEmberEnvConfig(config.EmberENV);
    this.outputAppBootError(config.modulePrefix, config.APP, contentForConfig);
    this.addBabelCompat();
  }

  @Memoize()
  private get portableHints(): PortableHint[] {
    return this.options.pluginHints.map(hint => {
      let cursor = join(this.origAppPackage.root, 'package.json');
      for (let i = 0; i < hint.resolve.length; i++) {
        let target = hint.resolve[i];
        if (i < hint.resolve.length - 1) {
          target = join(target, 'package.json');
        }
        cursor = resolve.sync(target, { basedir: dirname(cursor) });
      }

      return {
        requireFile: cursor,
        useMethod: hint.useMethod,
        packageVersion: maybeNodeModuleVersion(cursor),
      };
    });
  }

  private addBabelCompat() {
    let plugins = this.compatApp.extraBabelPlugins();
    let templateTransforms = this.compatApp.htmlbarsPlugins;
    let babelMacros = this.compatApp.macrosConfig.babelPluginConfig();
    let { plugins: templateMacros, setConfig } = MacrosConfig.transforms();
    setConfig(this.compatApp.macrosConfig);

    let config: CompatBabelState = {
      plugins,
      templateTransforms,
      babelMacros,
      templateMacros: templateMacros as any,
    };

    let portableConfig = new Portable({ hints: this.portableHints }).dehydrate(config);
    if (!portableConfig.isParallelSafe) {
      throw new Error(`non-serializble babel plugins or AST transforms found in your app`);
    }

    writeFileSync(
      join(locateEmbroiderWorkingDir(this.compatApp.root), '_babel_compat_.js'),
      `
      const { Portable } = require('@embroider/core/src/portable');
      module.exports = new Portable().hydrate(${JSON.stringify(portableConfig.value, null, 2)});
      `,
      'utf8'
    );
  }

  private addResolverConfig(config: CompatResolverOptions) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'resolver.json'), config, { spaces: 2 });
  }

  private addContentForConfig(contentForConfig: any) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'content-for.json'), contentForConfig, {
      spaces: 2,
    });

    // In addition to outputting content-for.json, we also want to check if content-for 'config-module' has a custom content.
    // If so, it means some classic addons used to provide this custom content, which is no longer supported.
    // Developers can deactivate this check (and the subsequent warning) with useAddonConfigModule
    if (this.compatApp.options.useAddonConfigModule) {
      let modulePrefix = this.configTree.readConfig().modulePrefix;

      // This is the default script provided by https://github.com/ember-cli/ember-cli/blob/master/lib/utilities/ember-app-utils.js#L84
      // When storeConfigInMeta is true, this content is always present in the config-module key of content-for.json
      const defaultConfigModule =
        `var prefix = '${modulePrefix}';\ntry {\n  var metaName = prefix + '/config/environment';\n  var rawConfig = document.querySelector('meta[name=\"' + metaName + '\"]').getAttribute('content');\n  var config = JSON.parse(decodeURIComponent(rawConfig));\n\n  var exports = { 'default': config };\n\n  Object.defineProperty(exports, '__esModule', { value: true });\n\n  return exports;\n}\ncatch(err) {\n  throw new Error('Could not read config from meta tag with name \"' + metaName + '\".');\n}\n`.replace(
          /\s/g,
          ''
        );

      const configModule = contentForConfig['/index.html']['config-module'];
      const diff = configModule.replace(/\s/g, '').replace(defaultConfigModule, '');

      if (diff.length) {
        throw new Error(`
          Your app uses at least one classic addon that provides content-for 'config-module'. This is no longer supported.
          With Embroider, you have full control over the config module, so classic addons no longer need to modify it under the hood.
          The following code is included via content-for 'config-module':

          ${configModule}

          1. If you want to keep the same behavior, add it to the app/environment.js.
          2. Once app/environment.js has the content you need, remove the present error by setting "useAddonConfigModule" to false in the build options.
        `);
      }
    }
  }

  private addEmberEnvConfig(emberEnvConfig: any) {
    outputJSONSync(join(locateEmbroiderWorkingDir(this.compatApp.root), 'ember-env.json'), emberEnvConfig, {
      spaces: 2,
    });
  }

  // Classic addons providing custom content-for "app-boot" is no longer supported.
  // The purpose of this error message is to help developers to move the classic addons code.
  // Developers can deactivate it with useAddonAppBoot build option.
  private outputAppBootError(modulePrefix: string, appConfig: any, contentForConfig: any) {
    if (!this.compatApp.options.useAddonAppBoot) {
      return;
    }

    // This is the default script provided by
    // https://github.com/ember-cli/ember-cli/blob/master/lib/utilities/ember-app-utils.js#L103
    const defaultAppBoot = `
      if (!runningTests) {
        require("${modulePrefix}/app")["default"].create(${JSON.stringify(appConfig || {})});
      }
    `.replace(/\s/g, '');

    const appBoot = contentForConfig['/index.html']['app-boot'];
    const diff = appBoot.replace(/\s/g, '').replace(defaultAppBoot, '');

    if (diff.length) {
      throw new Error(`
        Your app uses at least one classic addon that provides content-for 'app-boot'. This is no longer supported.
        With Embroider, you have full control over the app-boot script, so classic addons no longer need to modify it under the hood.
        The following code is used for your app boot:

        ${appBoot}

        1. If you want to keep the same behavior, copy and paste it to the app-boot script included in app/index.html.
        2. Once app/index.html has the content you need, remove the present error by setting "useAddonAppBoot" to false in the build options.
      `);
    }
  }
}

function defaultAddonPackageRules(): PackageRules[] {
  return readdirSync(join(__dirname, 'addon-dependency-rules'))
    .map(filename => {
      if (filename.endsWith('.js')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(join(__dirname, 'addon-dependency-rules', filename)).default;
      }
    })
    .filter(Boolean)
    .reduce((a, b) => a.concat(b), []);
}
