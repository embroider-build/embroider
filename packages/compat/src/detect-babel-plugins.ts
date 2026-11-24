import type { PluginItem } from '@babel/core';
import { readJSONSync } from 'fs-extra';
import { join, sep } from 'path';
import semver from 'semver';

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

// tests for the classic ember-cli-htmlbars-inline-precompile babel plugin
export function isInlinePrecompilePlugin(item: PluginItem) {
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

export function isHtmlbarColocation(item: PluginItem): boolean {
  let pluginPath: string;
  if (typeof item === 'string') {
    pluginPath = item;
  } else if (Array.isArray(item) && item.length > 0 && typeof item[0] === 'string') {
    pluginPath = item[0];
  } else {
    return false;
  }

  return pluginPath.includes(join(sep, 'ember-cli-htmlbars', sep, 'lib', sep, 'colocated-babel-plugin'));
}

function matchesSourceFile(filename: string) {
  return Boolean(htmlbarPathMatches.find(match => filename.endsWith(match)));
}

function hasProperties(item: any) {
  return item && (typeof item === 'object' || typeof item === 'function');
}

const htmlbarPathMatches = [
  ['htmlbars-inline-precompile', 'index.js'].join(sep),
  ['htmlbars-inline-precompile', 'lib', 'require-from-worker.js'].join(sep),
  ['htmlbars-inline-precompile', 'index'].join(sep),
  ['htmlbars-inline-precompile', 'lib', 'require-from-worker'].join(sep),
  ['ember-cli-htmlbars', 'index.js'].join(sep),
  ['ember-cli-htmlbars', 'lib', 'require-from-worker.js'].join(sep),
  ['ember-cli-htmlbars', 'index'].join(sep),
  ['ember-cli-htmlbars', 'lib', 'require-from-worker'].join(sep),
  ['babel-plugin-ember-template-compilation', 'src', 'node-main.js'].join(sep),
];

// Babel parses `import()` without a plugin since 7.8.0. The syntax plugin only
// exists for Babel 7, and Babel 8 refuses to load it.
export function needsDynamicImportSyntaxPlugin(emberCLIBabelRoot: string | undefined): boolean {
  if (!emberCLIBabelRoot) {
    return true;
  }
  try {
    let { version } = readJSONSync(require.resolve('@babel/core/package.json', { paths: [emberCLIBabelRoot] }));
    return semver.lt(version, '7.8.0');
  } catch {
    return true;
  }
}
