import { readJSONSync } from 'fs-extra';
import { join } from 'path';
import { TransformOptions, transform } from '@babel/core';
import { BoundExpectFile } from './file-assertions';
import { AppMeta, hbsToJS } from '@embroider/core';
import { Memoize } from 'typescript-memoize';

export class Transpiler {
  constructor(private outputPath: string) {
    this.transpile = this.transpile.bind(this);
    this.shouldTranspile = this.shouldTranspile.bind(this);
  }

  transpile(contents: string, fileAssert: BoundExpectFile): string {
    if (fileAssert.path.endsWith('.hbs')) {
      return transform(
        hbsToJS(contents, {
          filename: fileAssert.fullPath,
          compatModuleNaming: { rootDir: this.outputPath, modulePrefix: this.pkgJSON.name },
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
    let shouldTranspile = require(join(this.outputPath, '_babel_filter_'));
    return shouldTranspile(join(this.outputPath, relativePath)) as boolean;
  }

  @Memoize()
  private get pkgJSON() {
    return readJSONSync(join(this.outputPath, 'package.json'));
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
    return require(join(this.outputPath, this.emberMeta['babel'].filename)) as TransformOptions;
  }
}
