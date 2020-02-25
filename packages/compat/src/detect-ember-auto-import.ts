import { PluginItem } from '@babel/core';

export function isEmberAutoImportDynamic(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }
  return /(^|\/)ember-auto-import\//.test(pluginPath);
}
