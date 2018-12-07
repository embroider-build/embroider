import {
  Package,
  AppMeta,
  OutputPaths,
  getOrCreate,
} from '@embroider/core';
import sortBy from 'lodash/sortBy';
import resolve from 'resolve';
import { Memoize } from "typescript-memoize";
import { writeFileSync, ensureDirSync, copySync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { todo, unsupported } from './messages';
import cloneDeep from 'lodash/cloneDeep';
import AppDiffer from '@embroider/core/src/app-differ';
import { insertNewline, insertScriptTag, insertStyleLink, stripInsertionMarkers } from './dom-util';
import { JSDOM } from 'jsdom';
import { compile } from './js-handlebars';

export type ImplicitAssetType = "implicit-scripts" | "implicit-styles" | "implicit-test-scripts" | "implicit-test-styles";

interface BaseAsset {
  // where this asset should be placed, relative to the app's root
  relativePath: string;
}

export interface OnDiskAsset extends BaseAsset {
  kind: "on-disk";

  // absolute path to where we will find it
  sourcePath: string;
}

export interface InMemoryAsset extends BaseAsset {
  kind: "in-memory";

  // the actual bits
  source: string | Buffer;
}

// This represents an HTML entrypoint to the Ember app
export interface EmberAsset extends BaseAsset {
  kind: "ember";

  // an already-parsed document
  dom: JSDOM;

  // whether to include the test suite (in addition to the ember app)
  includeTests: boolean;

  // each of the Nodes in here points at where we should insert the
  // corresponding parts of the ember app. The Nodes themselves will be
  // replaced, so provide placeholders.

  // these are mandatory, the Ember app may need to put things into them.
  javascript: Node;
  styles: Node;
  implicitScripts: Node;
  implicitStyles: Node;

  // these are optional because you *may* choose to stick your implicit test
  // things into specific locations (which we need for backward-compat). But you
  // can leave these off and we will simply put them in the same places as the
  // non-test things.
  //
  // Do not confus these with controlling whether or not we will insert tests.
  // That is separately controlled via `includeTests`.
  testJavascript?: Node;
  implicitTestScripts?: Node;
  implicitTestStyles?: Node;
}

export type Asset = OnDiskAsset | InMemoryAsset | EmberAsset;

export type EmberENV = unknown;

export interface AppAdapter<TreeNames> {
  appJSSrcDir(treePaths: OutputPaths<TreeNames>): string;
  assets(treePaths: OutputPaths<TreeNames>): Asset[];
  autoRun(): boolean;
  mainModule(): string;
  mainModuleConfig(): unknown;
  modulePrefix(): string;
  impliedAssets(type: ImplicitAssetType): string[];
  templateCompilerSource(config: EmberENV): string;
  babelConfig(finalRoot: string): { config: { plugins: (string | [string,any])[]}, syntheticPlugins: Map<string, string> };
  emberENV(): EmberENV;
  externals(): string[];
}

export class AppBuilder<TreeNames> {
  constructor(
    private root: string,
    private app: Package,
    private adapter: AppAdapter<TreeNames>
  ) {}

  @Memoize()
  private get activeAddonDescendants(): Package[] {
    // todo: filter by addon-provided hook
    return this.app.findDescendants(dep => dep.isEmberPackage);
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

  private impliedAssets(type: ImplicitAssetType): any {
    let appAssets = this.adapter.impliedAssets(type).map(mod => resolve.sync(mod, { basedir: this. root }));
    let result = this.impliedAddonAssets(type).concat(appAssets);

    // This file gets created by addEmberEnv(). We need to insert it at the
    // beginning of the scripts.
    if (type === "implicit-scripts") {
      result.unshift(join(this.root, "_ember_env_.js"));
    }
    return result;
  }

  private impliedAddonAssets(type: ImplicitAssetType): any {
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

  private insertEmberApp(asset: EmberAsset, appFiles: Set<string>, jsEntrypoints: Map<string, Asset>): Asset[] {
    let newAssets: Asset[] = [];

    let appJS = getOrCreate(jsEntrypoints, `assets/${this.app.name}.js`, () => {
      let js = this.javascriptEntrypoint(this.app.name, appFiles);
      newAssets.push(js);
      return js;
    });

    insertScriptTag(asset, asset.javascript, appJS.relativePath).type = 'module';
    insertStyleLink(asset, asset.styles, `assets/${this.app.name}.css`);
    this.addImplicitJS(asset, asset.implicitScripts, "implicit-scripts");
    this.addImplicitCSS(asset, asset.implicitStyles,"implicit-styles");

    if (asset.includeTests) {
      let testJS = getOrCreate(jsEntrypoints, `assets/test.js`, () => {
        let js = this.testJSEntrypoint(appFiles);
        newAssets.push(js);
        return js;
      });
      insertScriptTag(asset, asset.testJavascript || asset.javascript, testJS.relativePath).type = 'module';
      this.addImplicitJS(asset, asset.implicitTestScripts || asset.implicitScripts, "implicit-test-scripts");
      this.addImplicitCSS(asset, asset.implicitTestStyles || asset.implicitStyles, "implicit-test-styles");
    }

    stripInsertionMarkers(asset);
    return newAssets;
  }

  private addImplicitJS(asset: EmberAsset, marker: Node, type: ImplicitAssetType) {
    for (let insertedScript of this.impliedAssets(type)) {
      let s = asset.dom.window.document.createElement("script");
      s.src = relative(dirname(join(this.root, asset.relativePath)), insertedScript);
      insertNewline(marker);
      marker.parentElement!.insertBefore(s, marker);
    }
  }

  private addImplicitCSS(asset: EmberAsset, marker: Node, type: ImplicitAssetType) {
    for (let insertedStyle of this.impliedAssets(type)) {
      let s = asset.dom.window.document.createElement("link");
      s.rel = "stylesheet";
      s.href = relative(dirname(join(this.root, asset.relativePath)), insertedStyle);
      insertNewline(marker);
      marker.parentElement!.insertBefore(s, marker);
    }
  }

  private appDiffer: AppDiffer | undefined;

  private updateAppJS(appJSPath: string): Set<string> {
    if (!this.appDiffer) {
      this.appDiffer = new AppDiffer(this.root, appJSPath, this.activeAddonDescendants);
    }
    this.appDiffer.update();
    return this.appDiffer.files;
  }

  private emitAsset(asset: Asset, appFiles: Set<string>, jsEntrypoints: Map<string, Asset>) {
    let destination = join(this.root, asset.relativePath);
    let newAssets: Asset[] = [];
    ensureDirSync(dirname(destination));
    switch (asset.kind) {
      case 'in-memory':
        writeFileSync(destination, asset.source, "utf8");
        break;
      case 'on-disk':
        copySync(asset.sourcePath, destination, { dereference: true });
        break;
      case 'ember':
        newAssets = this.insertEmberApp(asset, appFiles, jsEntrypoints);
        writeFileSync(destination, asset.dom.serialize(), "utf8");
        break;
      default:
        assertNever(asset);
    }
    return newAssets;
  }

  async build(inputPaths: OutputPaths<TreeNames>) {
    let appFiles = this.updateAppJS(this.adapter.appJSSrcDir(inputPaths));
    let emberENV = this.adapter.emberENV();
    let assets = this.adapter.assets(inputPaths);

    // this serves as a shared cache as we're filling out each of the html entrypoints
    let jsEntrypoints: Map<string, Asset> = new Map();

    let queue = assets.slice();
    while (queue.length > 0) {
      let asset = queue.shift()!;
      let newAssets = this.emitAsset(asset, appFiles, jsEntrypoints);
      queue = queue.concat(newAssets);
    }

    this.addTemplateCompiler(emberENV);
    this.addBabelConfig();
    this.addEmberEnv(emberENV);

    let externals = this.combineExternals();

    let meta: AppMeta = {
      version: 2,
      externals,
      entrypoints: assets.map(a => a.relativePath),
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

  // this is stuff that needs to get set globally before Ember loads. In classic
  // Ember CLI it was "vendor-prefix" content that would go at the start of the
  // vendor.js. We are going to make sure it's the first plain <script> in the
  // HTML that we hand to the final stage packager.
  private addEmberEnv(config: EmberENV) {
    let content = `window.EmberENV=${JSON.stringify(config, null, 2)};`;
    writeFileSync(join(this.root, "_ember_env_.js"), content, "utf8");
  }

  private javascriptEntrypoint(name: string, appFiles: Set<string>): Asset {
    let modulePrefix = this.adapter.modulePrefix();
    // for the app tree, we take everything
    let lazyModules = [...appFiles].map(relativePath => {
      if (!relativePath.startsWith('tests/') && (relativePath.endsWith('.js') || relativePath.endsWith('.hbs'))) {
        let noJS = relativePath.replace(/\.js$/, "");
        let noHBS = noJS.replace(/\.hbs$/, "");
        return {
          runtime: `${modulePrefix}/${noHBS}`,
          buildtime: `../${noJS}`,
        };
      }
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

  private testJSEntrypoint(appFiles: Set<string>): Asset {
    let testModules = [...appFiles].map(relativePath => {
      if (relativePath.startsWith("tests/") && relativePath.endsWith('-test.js')) {
        return `../${relativePath}`;
      }
    }).filter(Boolean) as string[];

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
      relativePath: 'assets/test.js'
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

{{#each eagerModules as |eagerModule| ~}}
  import "{{js-string-escape eagerModule}}";
{{/each}}

{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return require("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}

{{#if autoRun ~}}
  require("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}

{{#if testSuffix ~}}
  {{!- this is the traditional tests-suffix.js -}}
  require('../tests/test-helper');
  EmberENV.TESTS_FILE_LOADED = true;
{{/if}}
`);

function assertNever(_: never) {}
