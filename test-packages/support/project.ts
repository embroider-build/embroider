import FixturifyProject from 'fixturify-project';
import { join, dirname } from 'path';
import { ensureSymlinkSync } from 'fs-extra';
import merge from 'lodash/merge';
import Options from '../../packages/core/src/options';

function cliBuildFile(emberAppOptions = '', embroiderOptions: Options = {}) {
  return `
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    ${emberAppOptions}
  });
  if (process.env.CLASSIC) {
    return app.toTree();
  }
  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack, ${JSON.stringify(embroiderOptions, null, 2)});
};
`;
}

function addonBuildFile(emberAppOptions: any = {}, embroiderOptions: Options = {}) {
  return `
const EmberAddon = require('ember-cli/lib/broccoli/ember-addon');
module.exports = function(defaults) {
  let app = new EmberAddon(defaults, ${JSON.stringify(emberAppOptions, null, 2)});
  if (process.env.CLASSIC) {
    return app.toTree();
  }
const Webpack = require('@embroider/webpack').Webpack;
return require('@embroider/compat').compatBuild(app, Webpack, ${JSON.stringify(embroiderOptions)});
};`;
}

function addonIndexFile(content: string) {
  return `
module.exports = {
  name: require('./package').name,
  ${content}
};
`;
}

function environmentFile(appName: string) {
  return `
module.exports = function(environment) {
  let ENV = {
    modulePrefix: '${appName}',
    environment,
    rootURL: '/',
    locationType: 'auto',
    EmberENV: {
      FEATURES: {
      },
      EXTEND_PROTOTYPES: {
        Date: false
      }
    },
    APP: {}
  };
  return ENV;
};
`;
}

function addonEnvironmentFile() {
  return `module.exports = function(/* environment, appConfig */) {
    return { };
  };`;
}

function indexFile(appName: string, assetPrefix = '{{rootURL}}') {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>App</title>
    <meta name="description" content="">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    {{content-for "head"}}

    <link integrity="" rel="stylesheet" href="${assetPrefix}assets/vendor.css">
    <link integrity="" rel="stylesheet" href="${assetPrefix}assets/${appName}.css">

    {{content-for "head-footer"}}
  </head>
  <body>
    {{content-for "body"}}

    <script src="${assetPrefix}assets/vendor.js"></script>
    <script src="${assetPrefix}assets/${appName}.js"></script>

    {{content-for "body-footer"}}
  </body>
</html>
`;
}

function appJSFile() {
  return `
  import Application from '@ember/application';
import Resolver from './resolver';
import loadInitializers from 'ember-load-initializers';
import config from './config/environment';

const App = Application.extend({
  modulePrefix: config.modulePrefix,
  podModulePrefix: config.podModulePrefix,
  Resolver
});

loadInitializers(App, config.modulePrefix);

export default App;
`;
}

function engineIndex(lazy = false) {
  return `
const EngineAddon = require('ember-engines/lib/engine-addon');

module.exports = EngineAddon.extend({
  name: require('./package').name,
  lazyLoading: {
    enabled: ${lazy},
  },
});
`;
}

function engineConfig(name: string) {
  return `
module.exports = function(environment) {
  const ENV = {
    modulePrefix: '${name}',
    environment: environment
  }

  return ENV;
};
  `;
}

function engineAddonFile() {
  return `
import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';

const { modulePrefix } = config;

export default class YourEngine extends Engine {
  modulePrefix = modulePrefix;
  Resolver = Resolver;
}

loadInitializers(YourEngine, modulePrefix);
  `;
}

export class Project extends FixturifyProject {
  // FIXME: update fixturify-project to allow easier customization of `pkg`
  declare pkg: any;

  static emberNew(name = 'my-app', options?: any): Project {
    let app = new Project(name);
    app.files = {
      // you might think you want to pass params to customize cliBuildFile, but
      // that doesn't really work given how our tests work. Pass emberAppOptions
      // to BuildResult.build instead, because it needs access to the EmberApp
      // instance, which is not returned out of ember-cli-build.js.
      'ember-cli-build.js': cliBuildFile(),
      config: {
        'environment.js': environmentFile(name),
      },
      app: {
        'index.html': indexFile(name, options?.assetPrefix),
        styles: {
          'app.css': '',
        },
        'app.js': appJSFile(),
        'resolver.js': `export { default } from 'ember-resolver';`,
      },
    };
    app.linkPackage('ember-cli');
    app.linkPackage('loader.js');
    app.linkPackage('ember-cli-htmlbars');
    app.linkPackage('ember-cli-babel');
    app.linkPackage('ember-source');
    app.linkPackage('ember-resolver');
    app.linkPackage('@embroider/compat');
    app.linkPackage('@embroider/core');
    app.linkPackage('@embroider/webpack');
    app.linkPackage('@glimmer/component');

    return app;
  }

  static addonNew(emberAppOptions?: any, embroiderOptions?: Options): Project {
    let name = 'my-addon';
    let app = new Project(name);
    app.files = {
      'index.js': `module.exports = { name: "${name}" };`,
      'ember-cli-build.js': addonBuildFile(emberAppOptions, embroiderOptions),
      config: {
        'environment.js': addonEnvironmentFile(),
      },
      app: {},
      addon: {},
      tests: {
        dummy: {
          app: {
            'app.js': appJSFile(),
            'index.html': indexFile('dummy'),
            styles: {
              'app.css': '',
            },
          },
          config: {
            'environment.js': environmentFile('dummy'),
          },
        },
      },
    };
    app.linkDevPackage('ember-cli');
    app.linkDevPackage('loader.js');
    app.linkPackage('ember-cli-htmlbars');
    app.linkPackage('ember-cli-babel');
    app.linkPackage('@glimmer/component');
    app.linkDevPackage('ember-source');
    app.linkDevPackage('ember-resolver');
    app.linkDevPackage('@embroider/compat');
    app.linkDevPackage('@embroider/core');
    app.linkDevPackage('@embroider/webpack');

    app.pkg.keywords = ['ember-addon'];
    app.pkg['ember-addon'] = {
      configPath: 'tests/dummy/config',
    };
    return app;
  }

  private packageLinks: Map<string, string> = new Map();
  private devPackageLinks: Set<string> = new Set();
  private inRepoAddons: Set<Project> = new Set();

  linkDevPackage(name: string, target?: string) {
    this.devPackageLinks.add(name);
    this.linkPackage(name, target);
  }

  linkPackage(name: string, target?: string) {
    if (!target) {
      target = dirname(require.resolve(join(name, 'package.json')));
    }
    this.packageLinks.set(name, target);
  }

  addDependency(name: string | Project, version?: string, cb?: (project: FixturifyProject) => void): Project {
    return super.addDependency(name, version, cb) as Project;
  }

  addDevDependency(name: string | Project, version?: string, cb?: (project: FixturifyProject) => void): Project {
    return super.addDevDependency(name, version, cb) as Project;
  }

  writeSync(root?: string) {
    super.writeSync(root);
    let stack: { project: Project; root: string }[] = [{ project: this, root: root || this.root }];
    while (stack.length > 0) {
      let { project, root } = stack.shift()!;
      for (let [name, target] of project.packageLinks) {
        ensureSymlinkSync(target, join(root, project.name, 'node_modules', name), 'dir');
      }
      for (let dep of project.inRepoAddons) {
        let root = join(project.root, project.name, 'lib');
        dep.writeSync(root);
        stack.push({ project: dep, root });
      }
      for (let dep of project.dependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules') });
      }
      for (let dep of project.devDependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules') });
      }
    }
  }

  addAddon(name: string, indexContent = '') {
    let addon = this.addDependency(name);
    addon.files = {
      'index.js': addonIndexFile(indexContent),
      addon: {
        templates: {
          components: {},
        },
      },
      app: {},
    };
    addon.linkPackage('ember-cli-htmlbars');
    addon.linkPackage('ember-cli-babel');

    addon.pkg.keywords = ['ember-addon'];
    addon.pkg['ember-addon'] = {};
    return addon;
  }

  addDevAddon(name: string, indexContent = '') {
    let addon = this.addDevDependency(name);
    addon.files = {
      'index.js': addonIndexFile(indexContent),
      addon: {
        templates: {
          components: {},
        },
      },
      app: {},
    };
    addon.linkPackage('ember-cli-htmlbars');
    addon.linkPackage('ember-cli-babel');

    addon.pkg.keywords = ['ember-addon'];
    addon.pkg['ember-addon'] = {};
    return addon;
  }

  addInRepoAddon(name: string, indexContent = '', additionalFiles?: {}) {
    if (!this.pkg['ember-addon']) {
      this.pkg['ember-addon'] = {};
    }

    if (!this.pkg['ember-addon'].paths) {
      this.pkg['ember-addon'].paths = [];
    }

    this.pkg['ember-addon'].paths.push(`lib/${name}`);

    let addon = new Project(name);
    merge(
      addon.files,
      {
        'index.js': addonIndexFile(indexContent),
      },
      additionalFiles
    );
    addon.pkg['keywords'] = ['ember-addon'];
    this.inRepoAddons.add(addon);
    return addon;
  }

  addEngine(name: string, lazy: boolean): Project {
    let addonProject = this.addAddon(name);

    addonProject.pkg.keywords.push('ember-engine');

    merge(addonProject.files, {
      'index.js': engineIndex(lazy),
      config: {
        'environment.js': engineConfig(name),
      },
      addon: {
        'engine.js': engineAddonFile(),
      },
    });

    addonProject.linkDevPackage('ember-engines');

    return addonProject;
  }

  toJSON(): Project['files'];
  toJSON(key: string): Project['files'] | string;
  toJSON(key?: string) {
    let result = key ? super.toJSON(key) : super.toJSON();
    if (!key && this.packageLinks.size > 0) {
      let baseJSON = unwrapPackageName(result, this.name);
      let pkg = JSON.parse(baseJSON['package.json']);
      for (let [name] of this.packageLinks) {
        if (this.devPackageLinks.has(name)) {
          pkg.devDependencies[name] = '*';
        } else {
          pkg.dependencies[name] = '*';
        }
      }
      baseJSON['package.json'] = JSON.stringify(pkg, null, 2);
    }
    return result;
  }
}

function parseScoped(name: string) {
  let matched = name.match(/(@[^@\/]+)\/(.*)/);
  if (matched) {
    return {
      scope: matched[1],
      name: matched[2],
    };
  }
  return null;
}

function unwrapPackageName(obj: any, packageName: string) {
  let scoped = parseScoped(packageName);
  if (scoped) {
    return obj[scoped.scope][scoped.name];
  }
  return obj[packageName];
}
