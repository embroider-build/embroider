import { PluginItem } from '@babel/core';
import { join, sep } from 'path';

export function isEmberAutoImportDynamic(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }

  return pluginPath.includes(join(sep, 'ember-auto-import', sep));
}

export function isCompactReexports(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }

  return pluginPath.includes(join('babel-plugin-compact-reexports', sep));
}

export function isColocationPlugin(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }

  return pluginPath.includes(join('ember-cli-htmlbars', 'lib', 'colocated-babel-plugin', sep));
}
