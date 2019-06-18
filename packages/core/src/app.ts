import { AppMeta } from './metadata';
import { OutputPaths } from './wait-for-trees';
import { compile } from './js-handlebars';
import Package, { V2AddonPackage } from './package';
import resolve from 'resolve';
import { Memoize } from 'typescript-memoize';
import { writeFileSync, ensureDirSync, copySync, unlinkSync, statSync, existsSync } from 'fs-extra';
import { join, dirname } from 'path';
import { todo, debug, warn } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import AppDiffer from './app-differ';
import { PreparedEmberHTML } from './ember-html';
import { Asset, EmberAsset, InMemoryAsset, OnDiskAsset, ImplicitAssetPaths } from './asset';
import assertNever from 'assert-never';
import SourceMapConcat from 'fast-sourcemap-concat';
import Options from './options';
import { MacrosConfig } from '@embroider/macros';
import { TransformOptions, PluginItem } from '@babel/core';
import PortableBabelConfig from './portable-babel-config';
import { TemplateCompilerPlugins } from '.';
import TemplateCompiler from './template-compiler';
import { Resolver } from './resolver';
import { Options as AdjustImportsOptions } from './babel-plugin-adjust-imports';
import { tmpdir } from 'os';
import { explicitRelative } from './paths';

export type EmberENV = unknown;

/*
  This interface is the boundary between the general-purpose build system in
  AppBuilder and the messy specifics of apps.

    - CompatAppAdapter in `@embroider/compat` implements this interface for
      building based of a legacy ember-cli EmberApp instance
    - We will want to make a different class that implements this interface for
      building apps that don't need an EmberApp instance at all (presumably
      because they opt into new authoring standards.
*/
export interface AppAdapter<TreeNames> {
  // the set of addon packages that are active.
  readonly activeAddonDescendants: V2AddonPackage[];

  // path to the directory where the app's own Javascript lives. Doesn't include
  // any files copied out of addons, we take care of that generically in
  // AppBuilder.
  appJSSrcDir(treePaths: OutputPaths<TreeNames>): string;

  // this is where you declare what assets must be in the final output
  // (especially index.html, tests/index.html, and anything from your classic
  // public tree).
  assets(treePaths: OutputPaths<TreeNames>): Asset[];

  // whether the ember app should boot itself automatically
  autoRun(): boolean;

  // the ember app's main module
  mainModule(): string;

  // the configuration that will get passed into the ember app's main module.
  // This traditionally comes from the `APP` property returned by
  // config/environment.js.
  mainModuleConfig(): unknown;

  // The namespace for the app's own modules at runtime.
  //
  // (For apps, we _do_ still allow this to be arbitrary. This is in contrast
  // with _addons_, which absolutley must use their real NPM package name as
  // their modulePrefix.)
  modulePrefix(): string;

  // The public URL at which your app will be served.
  rootURL(): string;

  // The path to ember's template compiler source
  templateCompilerPath(): string;

  // Path to a build-time Resolver module to be used during template
  // compilation.
  templateResolver(): Resolver;

  // The template preprocessor plugins that are configured in the app.
  htmlbarsPlugins(): TemplateCompilerPlugins;

  // the app's preferred babel config. No need to worry about making it portable
  // yet, we will do that for you.
  babelConfig(): TransformOptions;

  // the babel version that works with your babelConfig.
  babelMajorVersion(): 6 | 7;

  // lets you add imports to javascript modules. We need this to implement
  // things like our addon compatibility rules for static components.
  extraImports(): { absPath: string; target: string; runtimeName?: string }[];

  // The environment settings used to control Ember itself. In a classic app,
  // this comes from the EmberENV property returned by config/environment.js.
  emberENV(): EmberENV;

  // when true, the app's own code is understood to already follow v2 standards.
  // For example, all imports of templates have an explicit `hbs` extension, and
  // all imports of your own package use relative imports instead of you rown
  // name. When false, your code is treated more leniently and you get the
  // auto-upgraded behaviors that v1 addons also get.
  strictV2Format(): boolean;
}

class ParsedEmberAsset {
  kind: 'parsed-ember' = 'parsed-ember';
  relativePath: string;
  fileAsset: EmberAsset;
  html: PreparedEmberHTML;

  constructor(asset: EmberAsset) {
    this.fileAsset = asset;
    this.html = new PreparedEmberHTML(asset);
    this.relativePath = asset.relativePath;
  }

  validFor(other: EmberAsset) {
    return this.fileAsset.mtime === other.mtime && this.fileAsset.size === other.size;
  }
}

class BuiltEmberAsset {
  kind: 'built-ember' = 'built-ember';
  relativePath: string;
  parsedAsset: ParsedEmberAsset;
  source: string;

  constructor(asset: ParsedEmberAsset) {
    this.parsedAsset = asset;
    this.source = asset.html.dom.serialize();
    this.relativePath = asset.relativePath;
  }
}

class ConcatenatedAsset {
  kind: 'concatenated-asset' = 'concatenated-asset';
  constructor(public relativePath: string, public sources: (OnDiskAsset | InMemoryAsset)[]) {}
  get sourcemapPath() {
    return this.relativePath.replace(/\.js$/, '') + '.map';
  }
}

type InternalAsset = OnDiskAsset | InMemoryAsset | BuiltEmberAsset | ConcatenatedAsset;

interface RouteFiles {
  route?: string;
  template?: string;
  controller?: string;
  children: Map<string, RouteFiles>;
}

class AppFiles {
  readonly tests: ReadonlyArray<string>;
  readonly components: ReadonlyArray<string>;
  readonly helpers: ReadonlyArray<string>;
  private perRoute: RouteFiles;
  readonly otherAppFiles: ReadonlyArray<string>;
  readonly relocatedFiles: Map<string, string>;

  constructor(relativePaths: Map<string, string | null>) {
    let tests: string[] = [];
    let components: string[] = [];
    let helpers: string[] = [];
    let otherAppFiles: string[] = [];
    this.perRoute = { children: new Map() };
    for (let relativePath of relativePaths.keys()) {
      if (!relativePath.endsWith('.js') && !relativePath.endsWith('.hbs')) {
        continue;
      }

      if (relativePath.startsWith('tests/')) {
        if (relativePath.endsWith('-test.js')) {
          tests.push(relativePath);
        }
        continue;
      }

      if (relativePath.startsWith('components/') || relativePath.startsWith('templates/components/')) {
        components.push(relativePath);
        continue;
      } else if (relativePath.startsWith('helpers/')) {
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

export class AppBuilder<TreeNames> {
  // for each relativePath, an Asset we have already emitted
  private assets: Map<string, InternalAsset> = new Map();

  constructor(
    private root: string,
    private app: Package,
    private adapter: AppAdapter<TreeNames>,
    private options: Required<Options>
  ) {
    MacrosConfig.shared().setOwnConfig(__filename, { active: true });
  }

  private scriptPriority(pkg: Package) {
    switch (pkg.name) {
      case 'loader.js':
        return 0;
      case 'ember-source':
        return 10;
      default:
        return 1000;
    }
  }

  private impliedAssets(type: keyof ImplicitAssetPaths, emberENV?: EmberENV): (OnDiskAsset | InMemoryAsset)[] {
    let result: (OnDiskAsset | InMemoryAsset)[] = this.impliedAddonAssets(type).map(
      (sourcePath: string): OnDiskAsset => {
        let stats = statSync(sourcePath);
        return {
          kind: 'on-disk',
          relativePath: explicitRelative(this.root, sourcePath),
          sourcePath,
          mtime: stats.mtimeMs,
          size: stats.size,
        };
      }
    );
    if (type === 'implicit-scripts') {
      result.unshift({
        kind: 'in-memory',
        relativePath: '_ember_env_.js',
        source: `window.EmberENV=${JSON.stringify(emberENV, null, 2)};`,
      });
    }
    return result;
  }

  private impliedAddonAssets(type: keyof ImplicitAssetPaths): string[] {
    let result = [];
    for (let addon of sortBy(this.adapter.activeAddonDescendants, this.scriptPriority.bind(this))) {
      let implicitScripts = addon.meta[type];
      if (implicitScripts) {
        for (let mod of implicitScripts) {
          result.push(resolve.sync(mod, { basedir: addon.root }));
        }
      }
    }
    return result;
  }

  @Memoize()
  private babelConfig(templateCompiler: TemplateCompiler, appFiles: AppFiles) {
    let babel = this.adapter.babelConfig();

    if (!babel.plugins) {
      babel.plugins = [];
    }

    // Our stage3 code is always allowed to use dynamic import. We may emit it
    // ourself when splitting routes.
    babel.plugins.push(
      require.resolve(
        this.adapter.babelMajorVersion() === 6
          ? 'babel-plugin-syntax-dynamic-import'
          : '@babel/plugin-syntax-dynamic-import'
      )
    );

    // this is @embroider/macros configured for full stage3 resolution
    babel.plugins.push(MacrosConfig.shared().babelPluginConfig());

    // this is our built-in support for the inline hbs macro
    babel.plugins.push([
      join(__dirname, 'babel-plugin-inline-hbs.js'),
      {
        templateCompiler,
        stage: 3,
      },
    ]);

    babel.plugins.push(this.adjustImportsPlugin(appFiles));

    return new PortableBabelConfig(babel, { basedir: this.root });
  }

  private adjustImportsPlugin(appFiles: AppFiles): PluginItem {
    let renamePackages = Object.assign(
      {},
      ...this.adapter.activeAddonDescendants.map(dep => dep.meta['renamed-packages'])
    );

    let renameModules = Object.assign(
      {},
      ...this.adapter.activeAddonDescendants.map(dep => dep.meta['renamed-modules'])
    );

    let activeAddons: AdjustImportsOptions['activeAddons'] = {};
    for (let addon of this.adapter.activeAddonDescendants) {
      activeAddons[addon.name] = addon.root;
    }

    let relocatedFiles: AdjustImportsOptions['relocatedFiles'] = {};
    for (let [relativePath, originalPath] of appFiles.relocatedFiles) {
      relocatedFiles[join(this.root, relativePath)] = originalPath;
    }

    let adjustOptions: AdjustImportsOptions = {
      activeAddons,
      renameModules,
      renamePackages,
      extraImports: this.adapter.extraImports(),
      relocatedFiles,

      // it's important that this is a persistent location, because we fill it
      // up as a side-effect of babel transpilation, and babel is subject to
      // persistent caching.
      externalsDir: join(tmpdir(), 'embroider', 'externals'),
    };
    return [require.resolve('./babel-plugin-adjust-imports'), adjustOptions];
  }

  private insertEmberApp(
    asset: ParsedEmberAsset,
    appFiles: AppFiles,
    prepared: Map<string, InternalAsset>,
    emberENV: EmberENV
  ) {
    let html = asset.html;

    // our tests entrypoint already includes a correct module dependency on the
    // app, so we only insert the app when we're not inserting tests
    if (!asset.fileAsset.includeTests) {
      let appJS = this.appJSAsset(appFiles, prepared);
      html.insertScriptTag(html.javascript, appJS.relativePath, { type: 'module' });
    }

    html.insertStyleLink(html.styles, `assets/${this.app.name}.css`);

    let implicitScripts = this.impliedAssets('implicit-scripts', emberENV);
    if (implicitScripts.length > 0) {
      let vendorJS = new ConcatenatedAsset('assets/vendor.js', implicitScripts);
      prepared.set(vendorJS.relativePath, vendorJS);
      html.insertScriptTag(html.implicitScripts, vendorJS.relativePath);
    }

    let implicitStyles = this.impliedAssets('implicit-styles');
    if (implicitStyles.length > 0) {
      let vendorCSS = new ConcatenatedAsset('assets/vendor.css', implicitStyles);
      prepared.set(vendorCSS.relativePath, vendorCSS);
      html.insertStyleLink(html.implicitStyles, vendorCSS.relativePath);
    }

    if (asset.fileAsset.includeTests) {
      let testJS = prepared.get(`assets/test.js`);
      if (!testJS) {
        testJS = this.testJSEntrypoint(appFiles, prepared);
        prepared.set(testJS.relativePath, testJS);
      }
      html.insertScriptTag(html.testJavascript, testJS.relativePath, { type: 'module' });

      let implicitTestScripts = this.impliedAssets('implicit-test-scripts');
      if (implicitTestScripts.length > 0) {
        let testSupportJS = new ConcatenatedAsset('assets/test-support.js', implicitTestScripts);
        prepared.set(testSupportJS.relativePath, testSupportJS);
        html.insertScriptTag(html.implicitTestScripts, testSupportJS.relativePath);
      }

      let implicitTestStyles = this.impliedAssets('implicit-test-styles');
      if (implicitTestStyles.length > 0) {
        let testSupportCSS = new ConcatenatedAsset('assets/test-support.css', implicitTestStyles);
        prepared.set(testSupportCSS.relativePath, testSupportCSS);
        html.insertStyleLink(html.implicitTestStyles, testSupportCSS.relativePath);
      }
    }
  }

  private appDiffer: AppDiffer | undefined;

  private updateAppJS(appJSPath: string): AppFiles {
    if (!this.appDiffer) {
      this.appDiffer = new AppDiffer(this.root, appJSPath, this.adapter.activeAddonDescendants);
    }
    this.appDiffer.update();
    return new AppFiles(this.appDiffer.files);
  }

  private prepareAsset(asset: Asset, appFiles: AppFiles, prepared: Map<string, InternalAsset>, emberENV: EmberENV) {
    if (asset.kind === 'ember') {
      let prior = this.assets.get(asset.relativePath);
      let parsed: ParsedEmberAsset;
      if (prior && prior.kind === 'built-ember' && prior.parsedAsset.validFor(asset)) {
        // we can reuse the parsed html
        parsed = prior.parsedAsset;
        parsed.html.clear();
      } else {
        parsed = new ParsedEmberAsset(asset);
      }
      this.insertEmberApp(parsed, appFiles, prepared, emberENV);
      prepared.set(asset.relativePath, new BuiltEmberAsset(parsed));
    } else {
      prepared.set(asset.relativePath, asset);
    }
  }

  private prepareAssets(requestedAssets: Asset[], appFiles: AppFiles, emberENV: EmberENV): Map<string, InternalAsset> {
    let prepared: Map<string, InternalAsset> = new Map();
    for (let asset of requestedAssets) {
      this.prepareAsset(asset, appFiles, prepared, emberENV);
    }
    return prepared;
  }

  private assetIsValid(asset: InternalAsset, prior: InternalAsset | undefined): boolean {
    if (!prior) {
      return false;
    }
    switch (asset.kind) {
      case 'on-disk':
        return prior.kind === 'on-disk' && prior.size === asset.size && prior.mtime === asset.mtime;
      case 'in-memory':
        return prior.kind === 'in-memory' && stringOrBufferEqual(prior.source, asset.source);
      case 'built-ember':
        return prior.kind === 'built-ember' && prior.source === asset.source;
      case 'concatenated-asset':
        return (
          prior.kind === 'concatenated-asset' &&
          prior.sources.length === asset.sources.length &&
          prior.sources.every((priorFile, index) => {
            let newFile = asset.sources[index];
            return this.assetIsValid(newFile, priorFile);
          })
        );
    }
    assertNever(asset);
  }

  private updateOnDiskAsset(asset: OnDiskAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    copySync(asset.sourcePath, destination, { dereference: true });
  }

  private updateInMemoryAsset(asset: InMemoryAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private updateBuiltEmberAsset(asset: BuiltEmberAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, 'utf8');
  }

  private async updateConcatenatedAsset(asset: ConcatenatedAsset) {
    let concat = new SourceMapConcat({
      outputFile: join(this.root, asset.relativePath),
      mapCommentType: asset.relativePath.endsWith('.js') ? 'line' : 'block',
      baseDir: this.root,
    });
    if (process.env.EMBROIDER_CONCAT_STATS) {
      let MeasureConcat = (await import('./measure-concat')).default;
      concat = new MeasureConcat(asset.relativePath, concat, this.root);
    }
    for (let source of asset.sources) {
      switch (source.kind) {
        case 'on-disk':
          concat.addFile(explicitRelative(this.root, source.sourcePath));
          break;
        case 'in-memory':
          if (typeof source.source !== 'string') {
            throw new Error(`attempted to concatenated a Buffer-backed in-memory asset`);
          }
          concat.addSpace(source.source);
          break;
        default:
          assertNever(source);
      }
    }
    await concat.end();
  }

  private async updateAssets(requestedAssets: Asset[], appFiles: AppFiles, emberENV: EmberENV) {
    let assets = this.prepareAssets(requestedAssets, appFiles, emberENV);
    for (let asset of assets.values()) {
      if (this.assetIsValid(asset, this.assets.get(asset.relativePath))) {
        continue;
      }
      debug('rebuilding %s', asset.relativePath);
      switch (asset.kind) {
        case 'on-disk':
          this.updateOnDiskAsset(asset);
          break;
        case 'in-memory':
          this.updateInMemoryAsset(asset);
          break;
        case 'built-ember':
          this.updateBuiltEmberAsset(asset);
          break;
        case 'concatenated-asset':
          await this.updateConcatenatedAsset(asset);
          break;
        default:
          assertNever(asset);
      }
    }
    for (let oldAsset of this.assets.values()) {
      if (!assets.has(oldAsset.relativePath)) {
        unlinkSync(join(this.root, oldAsset.relativePath));
      }
    }
    this.assets = assets;
    return [...assets.values()];
  }

  private gatherAssets(inputPaths: OutputPaths<TreeNames>): Asset[] {
    // first gather all the assets out of addons
    let assets: Asset[] = [];
    for (let pkg of this.adapter.activeAddonDescendants) {
      if (pkg.meta['public-assets']) {
        for (let [filename, appRelativeURL] of Object.entries(pkg.meta['public-assets'] || {})) {
          assets.push({
            kind: 'on-disk',
            sourcePath: join(pkg.root, filename),
            relativePath: appRelativeURL,
            mtime: 0,
            size: 0,
          });
        }
      }
    }
    // and finally tack on the ones from our app itself
    return assets.concat(this.adapter.assets(inputPaths));
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    let appFiles = this.updateAppJS(this.adapter.appJSSrcDir(inputPaths));
    let emberENV = this.adapter.emberENV();
    let assets = this.gatherAssets(inputPaths);

    let finalAssets = await this.updateAssets(assets, appFiles, emberENV);
    let templateCompiler = this.templateCompiler(emberENV);
    let babelConfig = this.babelConfig(templateCompiler, appFiles);
    this.addTemplateCompiler(templateCompiler);
    this.addBabelConfig(babelConfig);

    let assetPaths = assets.map(asset => asset.relativePath);
    for (let asset of finalAssets) {
      // our concatenated assets all have map files that ride along. Here we're
      // telling the final stage packager to be sure and serve the map files
      // too.
      if (asset.kind === 'concatenated-asset') {
        assetPaths.push(asset.sourcemapPath);
      }
    }

    let meta: AppMeta = {
      type: 'app',
      version: 2,
      assets: assetPaths,
      'template-compiler': {
        filename: '_template_compiler_.js',
        isParallelSafe: templateCompiler.isParallelSafe,
      },
      babel: {
        filename: '_babel_config_.js',
        isParallelSafe: babelConfig.isParallelSafe,
        majorVersion: this.adapter.babelMajorVersion(),
        fileFilter: '_babel_filter_.js',
      },
      'root-url': this.adapter.rootURL(),
    };

    if (!this.adapter.strictV2Format()) {
      meta['auto-upgraded'] = true;
    }

    let pkg = cloneDeep(this.app.packageJSON);
    if (pkg.keywords) {
      if (!pkg.keywords.includes('ember-addon')) {
        pkg.keywords.push('ember-addon');
      }
    } else {
      pkg.keywords = ['ember-addon'];
    }
    pkg['ember-addon'] = Object.assign({}, pkg['ember-addon'], meta);
    const pkgPath = join(this.root, 'package.json');

    // if package exists in the root, merge properties in pkg
    if (existsSync(pkgPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const existingPkg = require(pkgPath);
      merge(pkg, existingPkg);
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  }

  private templateCompiler(config: EmberENV) {
    let plugins = this.adapter.htmlbarsPlugins();
    if (!plugins.ast) {
      plugins.ast = [];
    }
    for (let macroPlugin of MacrosConfig.shared().astPlugins()) {
      plugins.ast.push(macroPlugin);
    }

    return new TemplateCompiler({
      plugins,
      compilerPath: resolve.sync(this.adapter.templateCompilerPath(), { basedir: this.root }),
      resolver: this.adapter.templateResolver(),
      EmberENV: config,
    });
  }

  private addTemplateCompiler(templateCompiler: TemplateCompiler) {
    writeFileSync(join(this.root, '_template_compiler_.js'), templateCompiler.serialize(), 'utf8');
  }

  private addBabelConfig(babelConfig: PortableBabelConfig) {
    if (!babelConfig.isParallelSafe) {
      warn('Your build is slower because some babel plugins are non-serializable');
    }
    writeFileSync(join(this.root, '_babel_config_.js'), babelConfig.serialize(), 'utf8');
    writeFileSync(join(this.root, '_babel_filter_.js'), babelFilterTemplate({ appRoot: this.root }), 'utf8');
  }

  private shouldSplitRoute(routeName: string) {
    return (
      !this.options.splitAtRoutes ||
      this.options.splitAtRoutes.find(pattern => {
        if (typeof pattern === 'string') {
          return pattern === routeName;
        } else {
          return pattern.test(routeName);
        }
      })
    );
  }

  private splitRoute(
    routeName: string,
    files: RouteFiles,
    addToParent: (routeName: string, filename: string) => void,
    addLazyBundle: (routeNames: string[], files: string[]) => void
  ) {
    let shouldSplit = routeName && this.shouldSplitRoute(routeName);
    let ownFiles = [];
    let ownNames = new Set();

    if (files.template) {
      if (shouldSplit) {
        ownFiles.push(files.template);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.template);
      }
    }

    if (files.controller) {
      if (shouldSplit) {
        ownFiles.push(files.controller);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.controller);
      }
    }

    if (files.route) {
      if (shouldSplit) {
        ownFiles.push(files.route);
        ownNames.add(routeName);
      } else {
        addToParent(routeName, files.route);
      }
    }

    for (let [childName, childFiles] of files.children) {
      this.splitRoute(
        `${routeName}.${childName}`,
        childFiles,

        (childRouteName: string, childFile: string) => {
          // this is our child calling "addToParent"
          if (shouldSplit) {
            ownFiles.push(childFile);
            ownNames.add(childRouteName);
          } else {
            addToParent(childRouteName, childFile);
          }
        },
        (routeNames: string[], files: string[]) => {
          addLazyBundle(routeNames, files);
        }
      );
    }

    if (ownFiles.length > 0) {
      addLazyBundle([...ownNames], ownFiles);
    }
  }

  private appJSAsset(appFiles: AppFiles, prepared: Map<string, InternalAsset>): InternalAsset {
    let cached = prepared.get(`assets/${this.app.name}.js`);
    if (cached) {
      return cached;
    }

    let requiredAppFiles = [appFiles.otherAppFiles];
    if (!this.options.staticComponents) {
      requiredAppFiles.push(appFiles.components);
    }
    if (!this.options.staticHelpers) {
      requiredAppFiles.push(appFiles.helpers);
    }

    let relativePath = `assets/${this.app.name}.js`;

    let lazyRoutes: { names: string[]; path: string }[] = [];
    for (let [routeName, routeFiles] of appFiles.routeFiles.children) {
      this.splitRoute(
        routeName,
        routeFiles,
        (_: string, filename: string) => {
          requiredAppFiles.push([filename]);
        },
        (routeNames: string[], files: string[]) => {
          let routeEntrypoint = `assets/_route_/${encodeURIComponent(routeNames[0])}.js`;
          if (!prepared.has(routeEntrypoint)) {
            prepared.set(routeEntrypoint, this.routeEntrypoint(routeEntrypoint, files));
          }
          lazyRoutes.push({ names: routeNames, path: this.importPaths(routeEntrypoint, relativePath).buildtime });
        }
      );
    }

    let amdModules = flatten(requiredAppFiles).map(file => this.importPaths(file, relativePath));

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo('app src tree');

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', amdModules);

    let source = entryTemplate({
      amdModules,
      autoRun: this.adapter.autoRun(),
      mainModule: explicitRelative(dirname(relativePath), this.adapter.mainModule()),
      appConfig: this.adapter.mainModuleConfig(),
      lazyRoutes,
    });

    let asset: InternalAsset = {
      kind: 'in-memory',
      source,
      relativePath,
    };
    prepared.set(relativePath, asset);
    return asset;
  }

  @Memoize()
  private get modulePrefix() {
    return this.adapter.modulePrefix();
  }

  private importPaths(appRelativePath: string, fromFile: string) {
    let noJS = appRelativePath.replace(/\.js$/, '');
    let noHBS = noJS.replace(/\.hbs$/, '');
    return {
      runtime: `${this.modulePrefix}/${noHBS}`,
      buildtime: explicitRelative(dirname(fromFile), noJS),
    };
  }

  private routeEntrypoint(relativePath: string, files: string[]) {
    let asset: InternalAsset = {
      kind: 'in-memory',
      source: routeEntryTemplate({
        files: files.map(f => this.importPaths(f, relativePath)),
      }),
      relativePath,
    };
    return asset;
  }

  private testJSEntrypoint(appFiles: AppFiles, prepared: Map<string, InternalAsset>): InternalAsset {
    const myName = 'assets/test.js';
    let testModules = appFiles.tests
      .map(relativePath => {
        return `../${relativePath}`;
      })
      .filter(Boolean) as string[];

    // tests necessarily also include the app. This is where we account for
    // that. The classic solution was to always include the app's separate
    // script tag in the tests HTML, but that isn't as easy for final stage
    // packagers to understand. It's better to express it here as a direct
    // module dependency.
    testModules.unshift(explicitRelative(dirname(myName), this.appJSAsset(appFiles, prepared).relativePath));

    let amdModules: { runtime: string; buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', amdModules);

    let source = entryTemplate({
      amdModules,
      eagerModules: testModules,
      testSuffix: true,
    });

    return {
      kind: 'in-memory',
      source,
      relativePath: myName,
    };
  }

  private gatherImplicitModules(
    section: 'implicit-modules' | 'implicit-test-modules',
    lazyModules: { runtime: string; buildtime: string }[]
  ) {
    for (let addon of this.adapter.activeAddonDescendants) {
      let implicitModules = addon.meta[section];
      if (implicitModules) {
        for (let name of implicitModules) {
          lazyModules.push({
            runtime: join(addon.name, name).replace(/\.hbs$/i, ''),
            buildtime: explicitRelative(join(this.root, 'assets'), join(addon.root, name)),
          });
        }
      }
    }
  }
}

const entryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let w = window;
let d = w.define;

{{#each amdModules as |amdModule| ~}}
  d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}").default;});
{{/each}}

{{#each eagerModules as |eagerModule| ~}}
  i("{{js-string-escape eagerModule}}");
{{/each}}

{{#if lazyRoutes}}
  w._embroiderRouteBundles_ = [
    {{#each lazyRoutes as |route|}}
    {
      names: {{{json-stringify route.names}}},
      load: function() {
        return import("{{js-string-escape route.path}}");
      }
    },
    {{/each}}
  ]
{{/if}}

{{#if autoRun ~}}
  i("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}

{{#if testSuffix ~}}
  {{!- TODO: both of these suffixes should get dynamically generated so they incorporate
       any content-for added by addons. -}}

  {{!- this is the traditional test-support-suffix.js -}}
  runningTests = true;
  if (window.Testem) {
    window.Testem.hookIntoTestFramework();
  }

  {{!- this is the traditional tests-suffix.js -}}
  i('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`) as (params: {
  amdModules?: ({ runtime: string; buildtime: string })[];
  eagerModules?: string[];
  autoRun?: boolean;
  mainModule?: string;
  appConfig?: unknown;
  testSuffix?: boolean;
  lazyRoutes?: { names: string[]; path: string }[];
}) => string;

const routeEntryTemplate = compile(`
import { importSync as i } from '@embroider/macros';
let d = window.define;
{{#each files as |amdModule| ~}}
d("{{js-string-escape amdModule.runtime}}", function(){ return i("{{js-string-escape amdModule.buildtime}}").default;});
{{/each}}
`) as (params: { files: { runtime: string; buildtime: string }[] }) => string;

function stringOrBufferEqual(a: string | Buffer, b: string | Buffer): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (a instanceof Buffer && b instanceof Buffer) {
    return Buffer.compare(a, b) === 0;
  }
  return false;
}

const babelFilterTemplate = compile(`
const { babelFilter } = require('@embroider/core');
module.exports = babelFilter("{{js-string-escape appRoot}}");
`) as (params: { appRoot: string }) => string;
