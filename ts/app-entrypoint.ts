import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import walkSync from 'walk-sync';
import { writeFileSync, ensureDirSync, readFileSync } from 'fs-extra';
import { join, dirname, relative } from 'path';
import { compile } from './js-handlebars';
import { todo } from './messages';
import App from './app';
import get from 'lodash/get';
import flatMap from 'lodash/flatmap';
import DependencyAnalyzer from './dependency-analyzer';
import cloneDeep from 'lodash/cloneDeep';
import Workspace from './workspace';
import { JSDOM } from 'jsdom';

const entryTemplate = compile(`
{{#each lazyModules as |lazyModule| ~}}
  {{{may-import-sync lazyModule}}}
{{/each}}
{{#if autoRun ~}}
  require("{{js-string-escape mainModule}}").default.create({{{json-stringify appConfig}}});
{{/if}}
`);

export default class extends BroccoliPlugin {
  constructor(
    workspace: Workspace,
    classicAppTree: Tree,
    htmlTree: Tree,
    private app: App,
    private analyzer: DependencyAnalyzer,
    private updateHTML: (entrypoint: string, dom) => void
  ){
    super([workspace, classicAppTree, analyzer, htmlTree, app.configTree], {});
  }

  async build() {
    // readConfig timing is safe here because app.configTree is in our input trees.
    let config = this.app.configTree.readConfig();

    // for the app tree, we take everything
    let lazyModules = walkSync(this.inputPaths[1], {
      globs: ['**/*.{js,hbs}'],
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

    // standard JS file name, not customizable. It's not final anyway (that is
    // up to the final stage packager). See also updateHTML in app.ts for where
    // we're enforcing this in the HTML.
    let appJS = join(this.outputPath, `assets/${this.app.name}.js`);

    let mainModule = join(this.outputPath, this.app.isModuleUnification ? 'src/main' : 'app');

    ensureDirSync(dirname(appJS));
    writeFileSync(appJS, entryTemplate({
      lazyModules,
      autoRun: this.app.autoRun,
      mainModule: relative(dirname(appJS), mainModule),
      appConfig: config.APP
    }), 'utf8');

    this.addConfigModule();
    this.addTemplateCompiler();
    this.addBabelConfig();

    // we are safe to access each addon.packageJSON because the Workspace is in
    // our inputTrees, so we know we are only running after any v1 packages have
    // already been build as v2.
    let externals = new Set(flatMap(this.app.activeDescendants, addon => get(addon.packageJSON, 'ember-addon.externals') || []));

    // similarly, we're safe to access analyzer.externals because the analyzer
    // is one of our input trees.
    this.analyzer.externals.forEach(name => externals.add(name));

    // At this point the externals list is correct in the sense that it points
    // out every place a package imports a thing that isnt't listed in its
    // dependencies. But this is stricter than the node_modules resolution
    // algorithm, which lets you get away with importing things that aren't
    // listed, so long as they're resolvable from your location.
    //
    // While it's more correct to list out all your peerDependencies explicitly,
    // in practice lots of packages don't, so it behooves us to be lenient in
    // the same way node is.
    //
    // TODO: implement

    let pkg = cloneDeep(this.app.originalPackageJSON);
    if (!pkg['ember-addon']) {
      pkg['ember-addon'] = {};
    }
    pkg['ember-addon'].externals = [...externals.values()];
    pkg['ember-addon'].entrypoints = ['index.html'];
    pkg['ember-addon']['template-compiler'] = '_template_compiler_.js';
    pkg['ember-addon']['babel-config'] = '_babel_config_.js';
    writeFileSync(join(this.outputPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');

    this.rewriteHTML();
  }

  private addConfigModule() {
    // todo: this assumes config-in-meta (which is the common default, but not the only possibility)
    ensureDirSync(join(this.outputPath, 'config'));
    writeFileSync(join(this.outputPath, 'config', 'environment.js'), `
    let config;
    try {
      let metaName = '${this.app.name}/config/environment';
      let rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
      config = JSON.parse(unescape(rawConfig));
    } catch(err) {
      throw new Error('Could not read config from meta tag with name "' + metaName + '".');
    }
    export default config;
    `, 'utf8');
  }

  // we could just use ember-source/dist/ember-template-compiler directly, but
  // apparently ember-cli adds some extra steps on top (like stripping BOM), so
  // we follow along and do those too.
  private addTemplateCompiler() {
    writeFileSync(join(this.outputPath, '_template_compiler_.js'), `
    var compiler = require('ember-source/dist/ember-template-compiler');
    var setupCompiler = require('ember-cli-vanilla/js/template-compiler').default;
    module.exports = setupCompiler(compiler);
    `, 'utf8');
  }

  private addBabelConfig() {
    writeFileSync(join(this.outputPath, '_babel_config_.js'), `
    module.exports = ${JSON.stringify(this.app.babelConfig, null, 2)};
    `, 'utf8');
  }

  private rewriteHTML() {
    let entrypoint = 'index.html';

    // inputsPaths[3] is the htmlTree we were given.
    let dom = new JSDOM(readFileSync(join(this.inputPaths[3], entrypoint), 'utf8'));
    this.updateHTML(entrypoint, dom);
    writeFileSync(join(this.outputPath, entrypoint), dom.serialize(), 'utf8');
  }
}
