import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import type { TransformOptions } from '@babel/core';
import { transform } from '@babel/core';
import type { BoundExpectFile } from './file-assertions';
import type { AppMeta } from '@embroider/shared-internals';
import { hbsToJS, RewrittenPackageCache } from '@embroider/shared-internals';
import { Memoize } from 'typescript-memoize';
import { getRewrittenLocation } from './rewritten-path';

export class Transpiler {
  private appOutputPath: string;
  constructor(private appDir: string) {
    let packageCache = RewrittenPackageCache.shared('embroider', appDir);
    this.appOutputPath = packageCache.maybeMoved(packageCache.get(appDir)).root;
    this.transpile = this.transpile.bind(this);
    this.shouldTranspile = this.shouldTranspile.bind(this);
  }

  transpile(contents: string, fileAssert: BoundExpectFile): string {
    if (fileAssert.path.endsWith('.hbs')) {
      return transform(
        hbsToJS(contents, {
          filename: fileAssert.fullPath,
          compatModuleNaming: { rootDir: this.appOutputPath, modulePrefix: this.pkgJSON.name },
        }),
        Object.assign({ filename: fileAssert.fullPath }, this.babelConfig)
      )!.code!;
    } else if (fileAssert.path.endsWith('.js')) {
      return transform(contents, Object.assign({ filename: fileAssert.fullPath }, this.babelConfig))!.code!;
    } else {
      return contents;
    }
  }

  shouldTranspile(relativePath: string) {
    let shouldTranspile = require(join(this.appOutputPath, '_babel_filter_'));
    return shouldTranspile(join(this.appDir, getRewrittenLocation(this.appDir, relativePath))) as boolean;
  }

  @Memoize()
  private get pkgJSON() {
    return readJSONSync(join(this.appOutputPath, 'package.json'));
  }

  private get emberMeta(): AppMeta {
    return this.pkgJSON['ember-addon'] as AppMeta;
  }

  @Memoize()
  private get babelConfig() {
    if (this.emberMeta['babel'].majorVersion !== 7) {
      throw new Error(`@embroider/test-support only suports babel 7`);
    }

    return require(join(this.appOutputPath, this.emberMeta['babel'].filename)) as TransformOptions;
  }
}
