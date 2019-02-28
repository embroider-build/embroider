import makeTransform from './glimmer/ast-transform';
import { join } from 'path';
import { sharedMacrosConfig } from '.';

export = {
  name: '@embroider/macros',
  setupPreprocessorRegistry(type: "parent" | "self", registry: any) {
    if (type === 'parent') {
      registry.add('htmlbars-ast-plugin', {
        name: '@embroider/macros',
        plugin: makeTransform((this as any).parent.root, sharedMacrosConfig()),
        baseDir() {
          return join(__dirname, '..');
        }
      });
    }
  }
};
