import { default as hbs } from './rollup-hbs-plugin';
import { default as publicEntrypoints } from './rollup-public-entrypoints';
import { default as appReexports } from './rollup-app-reexports';
import { default as clean } from 'rollup-plugin-delete';
import { default as keepAssets } from './rollup-keep-assets';
import type { Plugin } from 'rollup';

export class Addon {
  #srcDir: string;
  #destDir: string;

  constructor(params: { srcDir?: string; destDir?: string } = {}) {
    this.#srcDir = params.srcDir ?? 'src';
    this.#destDir = params.destDir ?? 'dist';
  }

  appReexports(patterns: string[]): Plugin {
    return appReexports({
      from: this.#srcDir,
      to: this.#destDir,
      include: patterns,
    });
  }

  publicEntrypoints(patterns: string[]) {
    return publicEntrypoints({ srcDir: this.#srcDir, include: patterns });
  }

  hbs() {
    return hbs();
  }

  clean() {
    return clean({ targets: `${this.#destDir}/*` });
  }

  keepAssets(patterns: string[]) {
    return keepAssets({
      from: this.#srcDir,
      include: patterns,
    });
  }

  output() {
    return { dir: this.#destDir, format: 'es', entryFileNames: '[name]' };
  }
}
