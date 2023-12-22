import type { Transform } from 'babel-plugin-ember-template-compilation';

export default function loadAstPlugins(registry: any): Transform[] {
  let plugins = registry.load('htmlbars-ast-plugin').map((wrapper: any) => wrapper.plugin);
  plugins.reverse();
  return plugins;
}
