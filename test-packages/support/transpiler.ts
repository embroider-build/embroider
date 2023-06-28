import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import { TransformOptions, transform } from '@babel/core';
import { BoundExpectFile } from './file-assertions';
import { AppMeta, hbsToJS, RewrittenPackageCache } from '../../packages/core/src/index';
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(join(this.appOutputPath, this.emberMeta['babel'].filename)) as TransformOptions;
  }
}
