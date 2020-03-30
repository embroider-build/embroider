import FixturifyProject from 'fixturify-project';
import { join, dirname } from 'path';
import { ensureSymlinkSync } from 'fs-extra';
import Options from '../../packages/core/src/options';

function cliBuildFile(emberAppOptions: string = '', embroiderOptions: Options = {}) {
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

function indexFile(appName: string) {
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

    <link integrity="" rel="stylesheet" href="{{rootURL}}assets/vendor.css">
    <link integrity="" rel="stylesheet" href="{{rootURL}}assets/${appName}.css">

    {{content-for "head-footer"}}
  </head>
  <body>
    {{content-for "body"}}

    <script src="{{rootURL}}assets/vendor.js"></script>
    <script src="{{rootURL}}assets/${appName}.js"></script>

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

export class Project extends FixturifyProject {
  static emberNew(name = 'my-app'): Project {
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
        'index.html': indexFile(name),
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
      for (let dep of project.dependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules') });
      }
      for (let dep of project.devDependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules') });
      }
    }
  }

  addAddon(name: string, indexContent = '', version: string = '1.0.0') {
    let addon = this.addDependency(name, version);
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

  addDevAddon(name: string, indexContent = '', version: string = '1.0.0') {
    let addon = this.addDevDependency(name, version);
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
