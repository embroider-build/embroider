import { ResolverLoader, packageName } from '@embroider/core';

export function addons(root: string): string[] {
  let rloader = new ResolverLoader(root);
  let { options } = rloader.resolver;
  let names = new Set<string>();
  for (let from of Object.keys(options.renameModules)) {
    let pName = packageName(from);
    if (pName) {
      names.add(pName);
    }
  }
  for (let from of Object.keys(options.renamePackages)) {
    names.add(from);
  }
  for (let name of options.engines
    .map(e => e.activeAddons)
    .flat()
    .map(a => a.name)) {
    names.add(name);
  }
  return [...names];
}
