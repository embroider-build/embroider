import { PluginItem } from "@babel/core";

function matchesSourceFile(filename: string) {
  return /babel-plugin-htmlbars-inline-precompile\/(index|lib\/require-from-worker)\.js$/.test(filename);
}

function hasProperties(item: any) {
  return item && (typeof item[0] === 'object' || typeof item[0] === 'function');
}

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
