import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, readFileSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import flatMap from 'lodash/flatmap';
import DependencyAnalyzer from './dependency-analyzer';
import cloneDeep from 'lodash/cloneDeep';
import Workspace from './workspace';
import { JSDOM } from 'jsdom';
import { AppPackageJSON } from './metadata';
import MovedApp from './moved-app';

const entryTemplate = compile(`
{{!-
    This function is the entrypoint that final stage packagers should
    use to lookup externals at runtime.
-}}
let w = window;
let r = w.require;
let d = w.define;
w._vanilla_ = function(specifier) {
  let m;
  if (specifier === 'require') {
    m = r;
  } else {
    m = r(specifier);
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
{{#each lazyModules as |lazyModule| ~}}
  d("{{js-string-escape lazyModule.runtime}}", function(){ return require("{{js-string-escape lazyModule.buildtime}}");});
{{/each}}
{{#if autoRun ~}}
  require("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}
`);

const testTemplate = compile(`
{{#each testModules as |testModule| ~}}
  import "{{js-string-escape testModule}}";
{{/each}}
`);

export default class extends BroccoliPlugin {
  private app: MovedApp;

  constructor(
    workspace: Workspace,
    classicAppTree: Tree,
    htmlTree: Tree,
    publicTree: Tree,
    private analyzer: DependencyAnalyzer,
    private updateHTML: (entrypoint: string, dom: JSDOM) => void
  ){
    super([workspace, classicAppTree, analyzer, htmlTree, publicTree, (workspace.app as MovedApp).configTree], {});
    this.app = workspace.app as MovedApp;
  }

  // todo
  private shouldBuildTests = true;

  private emberEntrypoints() {
    let entrypoints = ['index.html'];
    if (this.shouldBuildTests) {
      entrypoints.push('tests/index.html');
    }
    return entrypoints;
  }

  async build() {
    // readConfig timing is safe here because app.configTree is in our input trees.
    let config = this.app.configTree.readConfig();

    this.writeAppJS(config);
    this.writeTestJS();
    this.addTemplateCompiler();
    this.addBabelConfig();
    this.addEmberEnv(config.EmberENV);

    // we are safe to access each addon.packageJSON because the Workspace is in
    // our inputTrees, so we know we are only running after any v1 packages have
    // already been build as v2.
    let externals = new Set(flatMap(this.app.activeAddonDescendants, addon => addon.packageJSON['ember-addon'].externals || []));

    // similarly, we're safe to access analyzer.externals because the analyzer
    // is one of our input trees.
    this.analyzer.externals.forEach(name => externals.add(name));

    // This is the publicTree we were given. We need to list all the files in
    // here as "entrypoints", because an "entrypoint" is anything that is
    // guaranteed to have a valid URL in the final build output.
    let entrypoints = walkSync(this.inputPaths[4], {
      directories: false
    });

    let rawPkg = cloneDeep(this.app.originalPackageJSON);
    if (!rawPkg['ember-addon']) {
      rawPkg['ember-addon'] = {};
    }
    let pkg = rawPkg as AppPackageJSON;
    pkg['ember-addon'].externals = [...externals.values()];
    pkg['ember-addon'].entrypoints = this.emberEntrypoints().concat(entrypoints);
    pkg['ember-addon']['template-compiler'] = '_template_compiler_.js';
    pkg['ember-addon']['babel-config'] = '_babel_config_.js';
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

    this.rewriteHTML();
  }

  // we could just use ember-source/dist/ember-template-compiler directly, but
  // apparently ember-cli adds some extra steps on top (like stripping BOM), so
  // we follow along and do those too.
  private addTemplateCompiler() {
    writeFileSync(join(this.outputPath, '_template_compiler_.js'), `
    var compiler = require('ember-source/vendor/ember/ember-template-compiler');
    var setupCompiler = require('@embroider/core/src/template-compiler').default;
    module.exports = setupCompiler(compiler);
    `, 'utf8');
  }

  private addBabelConfig() {
    writeFileSync(join(this.outputPath, '_babel_config_.js'), `
    module.exports = ${JSON.stringify(this.app.babelConfig, null, 2)};
    `, 'utf8');
  }

  // this is stuff that needs to get set globally before Ember loads. In classic
  // Ember CLI is was "vendor-prefix" content that would go at the start of the
  // vendor.js. We are going to make sure it's the first plain <script> in the
  // HTML that we hand to the final stage packager.
  private addEmberEnv(config: any) {
    writeFileSync(join(this.outputPath, '_ember_env_.js'), `
    window.EmberENV=${JSON.stringify(config, null, 2)};
    `, 'utf8');
  }

  private rewriteHTML() {
    for (let entrypoint of  this.emberEntrypoints()) {
      // inputsPaths[3] is the htmlTree we were given.
      let dom = new JSDOM(readFileSync(join(this.inputPaths[3], entrypoint), 'utf8'));
      this.updateHTML(entrypoint, dom);
      let outputFile = join(this.outputPath, entrypoint);
      ensureDirSync(dirname(outputFile));
      writeFileSync(outputFile, dom.serialize(), 'utf8');
    }
  }

  private writeAppJS(config: any) {
    let mainModule = join(this.outputPath, this.app.isModuleUnification ? 'src/main' : 'app');
    // standard JS file name, not customizable. It's not final anyway (that is
    // up to the final stage packager). See also updateHTML in app.ts for where
    // we're enforcing this in the HTML.
    let appJS = join(this.outputPath, `assets/${this.app.name}.js`);

    // for the app tree, we take everything
    let lazyModules = walkSync(this.inputPaths[1], {
      globs: ['**/*.{js,hbs}'],
      ignore: ['tests/**'],
      directories: false
    }).map(specifier => {
      let noJS = specifier.replace(/\.js$/, '');
      let noHBS = noJS.replace(/\.hbs$/, '');
      return {
        runtime: `${config.modulePrefix}/${noHBS}`,
        buildtime: `../${noJS}`
      };
    });

    // for the src tree, we can limit ourselves to only known resolvable
    // collections
    todo("app src tree");

    // this is a backward-compatibility feature: addons can force inclusion of
    // modules.
    for (let addon of this.app.activeAddonDescendants) {
      let implicitModules = addon.packageJSON['ember-addon']['implicit-modules'];
      if (implicitModules) {
        for (let name of implicitModules) {
          lazyModules.push({
            runtime: `${addon.name}/${name}`,
            buildtime: relative(join(this.app.root, 'assets'), `${addon.root}/${name}`)
          });
        }
      }
    }
    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({
      lazyModules,
      autoRun: this.app.autoRun,
      mainModule: relative(dirname(appJS), mainModule),
      appConfig: config.APP
    }), 'utf8');
  }

  private writeTestJS() {
    let testJS = join(this.outputPath, `assets/test.js`);
    let testModules = walkSync(this.inputPaths[1], {
      globs: ['tests/**/*-test.js'],
      directories: false
    }).map(specifier => `../${specifier}`);
    ensureDirSync(dirname(testJS));
    writeFileSync(testJS, testTemplate({
      testModules
    }), 'utf8');
  }
}
