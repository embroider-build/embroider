import { AppMeta } from './metadata';
import { OutputPaths } from './wait-for-trees';
import { compile } from './js-handlebars';
import Package from './package';
import resolve from 'resolve';
import { Memoize } from "typescript-memoize";
import { writeFileSync, ensureDirSync, copySync, unlinkSync, statSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { todo, unsupported, debug } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import flatMap from 'lodash/flatMap';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';
import AppDiffer from './app-differ';
import { PreparedEmberHTML } from './ember-html';
import { Asset, EmberAsset, InMemoryAsset, OnDiskAsset, ImplicitAssetPaths } from './asset';
import assertNever from 'assert-never';
import SourceMapConcat from 'fast-sourcemap-concat';
import Options from './options';

export type EmberENV = unknown;

/*
  This interface is the boundary between the general-purpose build system in
  AppBuilder and the messy specifics of apps.

    - CompatAppAdapter in `@embroider/compat` implements this interface for
      building based of a legacy ember-cli EmberApp instance
    - We will want to make a different class that implmenets this interface for
      building apps that don't need an EmberApp instance at all (presumably
      because they opt into new authoring standards.
*/
export interface AppAdapter<TreeNames> {

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

  // optional method to force extra packages to be treated as dependencies of
  // the app.
  extraDependencies?(): Package[];

  // this is actual Javascript for a module that provides template compilation.
  // See how CompatAppAdapter does it for an example.
  templateCompilerSource(config: EmberENV): string;

  // this lets us figure out the babel config used by the app. You receive
  // "finalRoot" which is where the app will be when we run babel against it,
  // and you must make sure that the configuration will resolve correctly from
  // that path.
  //
  // - `config` is the actual babel configuration object.
  // - `syntheticPlugins` is a map from plugin names to Javascript source code
  //    for babel plugins. This can make it possible to serialize babel
  //    configs that would otherwise not be serializable.
  babelConfig(finalRoot: string): { config: { plugins: (string | [string,any])[]}, syntheticPlugins: Map<string, string> };

  // The environment settings used to control Ember itself. In a classic app,
  // this comes from the EmberENV property returned by config/environment.js.
  emberENV(): EmberENV;

  // the list of module specifiers that are used in the app that are not
  // resolvable at build time. This is how we figure out the "externals" for the
  // app itself as defined in SPEC.md.
  externals(): string[];
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
  constructor(public relativePath: string, public sources: (OnDiskAsset | InMemoryAsset)[]){}
  get sourcemapPath() {
    return this.relativePath.replace(/\.js$/, '') + '.map';
  }
}

type InternalAsset = OnDiskAsset | InMemoryAsset | BuiltEmberAsset | ConcatenatedAsset;

class AppFiles {
  readonly tests: ReadonlyArray<string>;
  readonly components: ReadonlyArray<string>;
  readonly helpers: ReadonlyArray<string>;
  readonly otherAppFiles: ReadonlyArray<string>;

  constructor(relativePaths: Set<string>) {
    let tests: string[] = [];
    let components: string[] = [];
    let helpers: string[] = [];
    let otherAppFiles: string[] = [];
    for (let relativePath of relativePaths) {
      if (relativePath.startsWith("tests/") && relativePath.endsWith('-test.js')) {
        tests.push(relativePath);
        continue;
      }
      if (!relativePath.startsWith('tests/') && (relativePath.endsWith('.js') || relativePath.endsWith('.hbs'))) {
        if (relativePath.startsWith('components/') || relativePath.startsWith('templates/components')) {
          components.push(relativePath);
        } else if (relativePath.startsWith('helpers/')) {
          helpers.push(relativePath);
        } else {
          otherAppFiles.push(relativePath);
        }
        continue;
      }
    }
    this.tests = tests;
    this.components = components;
    this.helpers = helpers;
    this.otherAppFiles = otherAppFiles;
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
  ) {}

  @Memoize()
  private get activeAddonDescendants(): Package[] {
    // todo: filter by addon-provided hook
    let shouldInclude = (dep: Package) => dep.isEmberPackage;

    let result = this.app.findDescendants(shouldInclude);
    if (this.adapter.extraDependencies) {
      let extras = this.adapter.extraDependencies().filter(shouldInclude);
      let extraDescendants = flatMap(extras, dep => dep.findDescendants(shouldInclude));
      result = [...result, ...extras, ...extraDescendants];
    }
    return result;
  }

  private scriptPriority(pkg: Package) {
    switch (pkg.name) {
      case "loader.js":
        return 0;
      case "ember-source":
        return 10;
      default:
        return 1000;
    }
  }

  private impliedAssets(type: keyof ImplicitAssetPaths, emberENV?: EmberENV): (OnDiskAsset | InMemoryAsset)[] {
    let result: (OnDiskAsset | InMemoryAsset)[] = this.impliedAddonAssets(type).map((sourcePath: string): OnDiskAsset => {
      let stats = statSync(sourcePath);
      return {
        kind: 'on-disk',
        relativePath: relative(this.root, sourcePath),
        sourcePath,
        mtime: stats.mtimeMs,
        size: stats.size,
      };
    });
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
    for (let addon of sortBy(
      this.activeAddonDescendants,
      this.scriptPriority.bind(this)
    )) {
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
  private get babelConfig() {
    let rename = Object.assign(
      {},
      ...this.activeAddonDescendants.map(dep => dep.meta["renamed-modules"])
    );
    let babel = this.adapter.babelConfig(this.root);

    // this is our own plugin that patches up issues like non-explicit hbs
    // extensions and packages importing their own names.
    babel.config.plugins.push([require.resolve('./babel-plugin'), {
      ownName: this.app.name,
      basedir: this.root,
      rename
    }]);
    return babel;
  }

  private appJSAsset(appFiles: AppFiles, prepared: Map<string, InternalAsset>): InternalAsset {
    let appJS = prepared.get(`assets/${this.app.name}.js`);
    if (!appJS) {
      appJS = this.javascriptEntrypoint(this.app.name, appFiles);
      prepared.set(appJS.relativePath, appJS);
    }
    return appJS;
  }

  private insertEmberApp(asset: ParsedEmberAsset, appFiles: AppFiles, prepared: Map<string, InternalAsset>, emberENV: EmberENV) {
    let html = asset.html;

    // our tests entrypoint already includes a correct module dependency on the
    // app, so we only insert the app when we're not inserting tests
    if (!asset.fileAsset.includeTests) {
      let appJS = this.appJSAsset(appFiles, prepared);
      html.insertScriptTag(html.javascript, appJS.relativePath, { type: 'module' });
    }

    html.insertStyleLink(html.styles, `assets/${this.app.name}.css`);

    let implicitScripts = this.impliedAssets("implicit-scripts", emberENV);
    if (implicitScripts.length > 0) {
      let vendorJS = new ConcatenatedAsset('assets/vendor.js', implicitScripts);
      prepared.set(vendorJS.relativePath, vendorJS);
      html.insertScriptTag(html.implicitScripts, vendorJS.relativePath);
    }

    let implicitStyles = this.impliedAssets("implicit-styles");
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

      let implicitTestScripts = this.impliedAssets("implicit-test-scripts");
      if (implicitTestScripts.length > 0) {
        let testSupportJS = new ConcatenatedAsset('assets/test-support.js', implicitTestScripts);
        prepared.set(testSupportJS.relativePath, testSupportJS);
        html.insertScriptTag(html.implicitTestScripts, testSupportJS.relativePath);
      }

      let implicitTestStyles = this.impliedAssets("implicit-test-styles");
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
      this.appDiffer = new AppDiffer(this.root, appJSPath, this.activeAddonDescendants);
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
    switch(asset.kind) {
      case 'on-disk':
        return prior.kind === 'on-disk' && prior.size === asset.size && prior.mtime === asset.mtime;
      case 'in-memory':
        return prior.kind === 'in-memory' && stringOrBufferEqual(prior.source, asset.source);
      case 'built-ember':
        return prior.kind === 'built-ember' && prior.source === asset.source;
      case 'concatenated-asset':
        return prior.kind === 'concatenated-asset' &&
          prior.sources.length === asset.sources.length &&
          prior.sources.every((priorFile, index) => {
            let newFile = asset.sources[index];
            return this.assetIsValid(newFile, priorFile);
          });
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
    writeFileSync(destination, asset.source, "utf8");
  }

  private updateBuiltEmberAsset(asset: BuiltEmberAsset) {
    let destination = join(this.root, asset.relativePath);
    ensureDirSync(dirname(destination));
    writeFileSync(destination, asset.source, "utf8");
  }

  private async updateConcatenatedAsset(asset: ConcatenatedAsset) {
    let concat = new SourceMapConcat({
      outputFile: join(this.root, asset.relativePath),
      mapCommentType: asset.relativePath.endsWith('.js') ? 'line' : 'block',
      baseDir: this.root,
    });
    for (let source of asset.sources) {
      switch (source.kind) {
        case 'on-disk':
          concat.addFile(relative(this.root, source.sourcePath));
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
    for (let pkg of this.activeAddonDescendants) {
      if (pkg.meta['public-assets']) {
        for (let [filename, appRelativeURL] of Object.entries(pkg.meta['public-assets'])) {
          assets.push({
            kind: 'on-disk',
            sourcePath: join(pkg.root, filename),
            relativePath: appRelativeURL,
            mtime: 0,
            size: 0
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
    this.addTemplateCompiler(emberENV);
    this.addBabelConfig();

    let externals = this.combineExternals();

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
      version: 2,
      externals,
      assets: assetPaths,
      ["template-compiler"]: "_template_compiler_.js",
      ["babel-config"]: "_babel_config_.js",
    };

    let pkg = cloneDeep(this.app.packageJSON);
    pkg["ember-addon"] = Object.assign({}, pkg["ember-addon"], meta);
    writeFileSync(
      join(this.root, "package.json"),
      JSON.stringify(pkg, null, 2),
      "utf8"
    );
  }

  private combineExternals() {
    let allAddonNames = new Set(this.activeAddonDescendants.map(d => d.name));
    let externals = new Set();
    for (let addon of this.activeAddonDescendants) {
      if (!addon.meta.externals) {
        continue;
      }
      for (let name of addon.meta.externals) {
        if (allAddonNames.has(name)) {
          unsupported(`${addon.name} imports ${name} but does not directly depend on it.`);
        } else {
          externals.add(name);
        }
      }
    }

    for (let name of this.adapter.externals()) {
      if (allAddonNames.has(name)) {
        unsupported(`your app imports ${name} but does not directly depend on it.`);
      } else {
        externals.add(name);
      }
    }
    return [...externals.values()];
  }

  // we could just use ember-source/dist/ember-template-compiler directly, but
  // apparently ember-cli adds some extra steps on top (like stripping BOM), so
  // we follow along and do those too.
  private addTemplateCompiler(config: EmberENV) {
    writeFileSync(
      join(this.root, "_template_compiler_.js"),
      this.adapter.templateCompilerSource(config),
      "utf8"
    );
  }

  private addBabelConfig() {
    let { config, syntheticPlugins } = this.babelConfig;

    for (let [name, source] of syntheticPlugins) {
      let fullName = join(this.root, name);
      writeFileSync(fullName, source, 'utf8');
      let index = config.plugins.indexOf(name);
      config.plugins[index] = fullName;
    }

    writeFileSync(
      join(this.root, "_babel_config_.js"),
      `
    module.exports = ${JSON.stringify(config, null, 2)};
    `,
      "utf8"
    );
  }

  private javascriptEntrypoint(name: string, appFiles: AppFiles): InternalAsset {
    let modulePrefix = this.adapter.modulePrefix();

    let requiredAppFiles = [appFiles.otherAppFiles];
    if (!this.options.staticComponents) {
      requiredAppFiles.push(appFiles.components);
    }
    if(!this.options.staticHelpers) {
      requiredAppFiles.push(appFiles.helpers);
    }

    let lazyModules = flatten(requiredAppFiles).map(relativePath => {
      let noJS = relativePath.replace(/\.js$/, "");
      let noHBS = noJS.replace(/\.hbs$/, "");
      return {
        runtime: `${modulePrefix}/${noHBS}`,
        buildtime: `../${noJS}`,
      };
    }).filter(Boolean) as { runtime: string, buildtime: string }[];

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    this.gatherImplicitModules('implicit-modules', lazyModules);

    let relativePath = `assets/${name}.js`;

    let source = entryTemplate({
      needsEmbroiderHook: true,
      lazyModules,
      autoRun: this.adapter.autoRun(),
      mainModule: relative(dirname(relativePath), this.adapter.mainModule()),
      appConfig: this.adapter.mainModuleConfig(),
    });

    return {
      kind: 'in-memory',
      source,
      relativePath,
    };
  }

  private testJSEntrypoint(appFiles: AppFiles, prepared: Map<string, InternalAsset>): InternalAsset {
    const myName = 'assets/test.js';
    let testModules = appFiles.tests.map(relativePath => {
      return `../${relativePath}`;
    }).filter(Boolean) as string[];

    // tests necessarily also include the app. This is where we account for
    // that. The classic solution was to always include the app's separate
    // script tag in the tests HTML, but that isn't as easy for final stage
    // packagers to understand. It's better to express it here as a direct
    // module dependency.
    testModules.unshift('./' + relative(dirname(myName), this.appJSAsset(appFiles, prepared).relativePath));

    let lazyModules: { runtime: string, buildtime: string }[] = [];
    // this is a backward-compatibility feature: addons can force inclusion of
    // test support modules.
    this.gatherImplicitModules('implicit-test-modules', lazyModules);

    let source = entryTemplate({
      lazyModules,
      eagerModules: testModules,
      testSuffix: true
    });

    return {
      kind: 'in-memory',
      source,
      relativePath: myName
    };
  }

  private gatherImplicitModules(section: "implicit-modules" | "implicit-test-modules", lazyModules: { runtime: string, buildtime: string }[]) {
    for (let addon of this.activeAddonDescendants) {
      let implicitModules = addon.meta[section];
      if (implicitModules) {
        for (let name of implicitModules) {
          lazyModules.push({
            runtime: join(addon.name, name),
            buildtime: relative(
              join(this.root, "assets"),
              join(addon.root, name)
            ),
          });
        }
      }
    }
  }
}

const entryTemplate = compile(`
import { require as r } from '@embroider/core';
let w = window;
let d = w.define;

{{#if needsEmbroiderHook}}
  {{!-
    This function is the entrypoint that final stage packagers should
    use to lookup externals at runtime.
  -}}
  w._embroider_ = function(specifier) {
    let m;
    if (specifier === 'require') {
      m = w.require;
    } else {
      m = w.require(specifier);
    }
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
    return m;
  };
{{/if}}


{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return r("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}

{{#each eagerModules as |eagerModule| ~}}
  r("{{js-string-escape eagerModule}}");
{{/each}}

{{#if autoRun ~}}
  r("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
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
  r('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`);

function stringOrBufferEqual(a: string | Buffer, b: string | Buffer): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (a instanceof Buffer && b instanceof Buffer) {
    return Buffer.compare(a,b) === 0;
  }
  return false;
}
