import V1Addon from '../v1-addon';
import writeFile from 'broccoli-file-creator';
import { join } from 'path';

function createIndexContents(config: any): string {
  return `export default ${JSON.stringify(config)};`;
}

/**
 * The `ember-get-config` addon conceptually does just one thing: re-exports the `config/environment` runtime module
 * from the host app so that addons can import it themseles. It handles the "hard part" of knowing what the host app's
 * module name is, since that's not something an addon can normally know ahead of time.
 *
 * From a dependency graph perspective though, declaring all of the dependencies correctly would require a circular
 * dependency from the addon back to the host app itself, which we don't want to introduce.
 *
 * We need to basically re-implement the entire addon's behavior so that it still exports the app's
 * `config/environment` runtime value, but without needing it to actually export from the host app's module.
 */
export default class extends V1Addon {
  get v2Tree() {
    const configModulePath = join(this.app.root, 'config/environment.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const configModule = require(configModulePath);
    const appEnvironmentConfig = configModule(this.app.env);

    return writeFile('index.js', createIndexContents(appEnvironmentConfig));
  }
}
