import FixturifyProject from 'fixturify-project';
import { join, dirname } from 'path';
import { ensureSymlinkSync } from 'fs-extra';
import Options from '../src/options';

function cliBuildFile(embroiderOptions: Options = {}) {
  return `
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    tests: false
  });
  if (process.env.CLASSIC) {
    return app.toTree();
  }
  const Webpack = require('@embroider/webpack').Webpack;
  return require('@embroider/compat').compatBuild(app, Webpack, ${JSON.stringify(embroiderOptions, null, 2)});
};
`;
}

const addonIndexFile = `
module.exports = {
  name: require('./package').name,
};
`;

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
  private packageLinks: Map<string, string> = new Map();

  linkPackage(name: string, target?: string) {
    if (!target) {
      target = dirname(require.resolve(join(name, 'package.json')));
    }
    this.packageLinks.set(name, target);
  }

  addDependency(name: string | Project, version?: string, cb?: (project: FixturifyProject) => void): Project {
    return super.addDependency(name, version, cb) as Project;
  }

  writeSync(root?: string) {
    super.writeSync(root);
    let stack: { project: Project, root: string }[] = [{ project: this, root: root || this.root } ];
    while (stack.length > 0) {
      let { project, root } = stack.shift()!;
      for (let [name, target] of project.packageLinks) {
        ensureSymlinkSync(target, join(root, project.name, 'node_modules', name), 'dir');
      }
      for (let dep of project.dependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules')});
      }
      for (let dep of project.devDependencies()) {
        stack.push({ project: dep as Project, root: join(root, project.name, 'node_modules')});
      }
    }
  }

  toJSON(): Project["files"];
  toJSON(key: string): Project["files"] | string;
  toJSON(key?: string) {
    let result = key ? super.toJSON(key) : super.toJSON();
    if (!key && this.packageLinks.size > 0) {
      let pkg = JSON.parse((result as any)[this.name]['package.json']);
      for (let [name] of this.packageLinks) {
        pkg.dependencies[name] = '*';
      }
      (result as any)[this.name]['package.json'] = JSON.stringify(pkg, null, 2);
    }
    return result;
  }
}

export function emberProject(embroiderOptions: Options = {}) {
  let name = 'my-app';
  let app = new Project(name);
  app.files = {
    'ember-cli-build.js': cliBuildFile(embroiderOptions),
    config: {
      'environment.js': environmentFile(name)
    },
    app: {
      'index.html': indexFile(name),
      styles: {
        'app.css': ''
      },
      'app.js': appJSFile(),
      'resolver.js': `export { default } from 'ember-resolver';`
    }
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
  return app;
}

export function addAddon(app: Project, name: string) {
  let addon = app.addDependency(name);
  addon.files = {
    'index.js': addonIndexFile,
    addon: {
      templates: {
        components: {
        }
      }
    }
  };
  addon.linkPackage('ember-cli-htmlbars');
  addon.linkPackage('ember-cli-babel');

  addon.pkg.keywords = ['ember-addon'];
  addon.pkg['ember-addon'] = {};
  return addon;
}
