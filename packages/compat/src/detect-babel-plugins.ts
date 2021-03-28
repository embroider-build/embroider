import type { PluginItem } from '@babel/core';

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

export function isCompactReexports(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }
  return /(^|\/)babel-plugin-compact-reexports\//.test(pluginPath);
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
  return /(^|\/)ember-cli-htmlbars\/lib\/colocated-babel-plugin/.test(pluginPath);
}

// tests for all the ways the inline hbs babel plugin could be listed.
export function isInlinePrecompilePlugin(item: PluginItem): boolean {
  function matchesSourceFile(filename: string) {
    return /(htmlbars-inline-precompile|ember-cli-htmlbars|babel-plugin-htmlbars-inline-precompile)\/(index|lib\/require-from-worker)(\.js)?$/.test(
      filename
    );
  }

  if (typeof item === 'string') {
    return matchesSourceFile(item);
  }
  if (hasProperties(item) && (item as any)._parallelBabel) {
    return matchesSourceFile((item as any)._parallelBabel.requireFile);
  }
  if (Array.isArray(item) && item.length > 0) {
    if (typeof item[0] === 'string') {
      return matchesSourceFile(item[0]);
    }
    if (hasProperties(item[0]) && (item[0] as any)._parallelBabel) {
      return matchesSourceFile((item[0] as any)._parallelBabel.requireFile);
    }
  }
  return false;
}

function hasProperties(item: any) {
  return item && (typeof item === 'object' || typeof item === 'function');
}
