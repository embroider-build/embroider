import { readJSONSync, existsSync } from 'fs-extra';
import { join } from 'path';
import type { TransformOptions } from '@babel/core';
import { transform } from '@babel/core';
import type { BoundExpectFile } from './file-assertions';
import { hbsToJS, locateEmbroiderWorkingDir, RewrittenPackageCache } from '@embroider/core/src/index';
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
    // Depending on how the app builds, the babel filter is not at the same location
    let embroiderLocation = join(locateEmbroiderWorkingDir(this.appDir), '_babel_filter_.js');
    let shouldTranspile = existsSync(embroiderLocation)
      ? require(embroiderLocation)
      : require(join(this.appOutputPath, '_babel_filter_'));
    return shouldTranspile(join(this.appDir, getRewrittenLocation(this.appDir, relativePath))) as boolean;
  }

  @Memoize()
  private get pkgJSON() {
    return readJSONSync(join(this.appOutputPath, 'package.json'));
  }

  @Memoize()
  private get babelConfig() {
    let origDir = process.cwd();
    process.chdir(this.appOutputPath);
    try {
      return require(join(this.appOutputPath, './babel.config.cjs')) as TransformOptions;
    } finally {
      process.chdir(origDir);
    }
  }
}
