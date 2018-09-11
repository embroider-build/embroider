import { todo } from './messages';
import { UnwatchedDir } from 'broccoli-source';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import { compile } from './js-handlebars';
import { Memoize } from 'typescript-memoize';
import { Tree } from 'broccoli-plugin';

const appImportsTemplate = compile(`{{#each imports as |import|}}
import '{{js-string-escape import}}';
{{/each}}`);

export interface TrackedImport {
  assetPath: string;
  options: { type: string, outputFile: string | undefined };
}

export class TrackedImports {
  constructor(private packageName: string, private trackedImports: TrackedImport[]) {
  }

  @Memoize()
  get categorized(): { app: string[], test: string[] } {
    let app = [];
    let test = [];

    if (this.trackedImports) {
      this.trackedImports.forEach(({ assetPath, options }) => {
        let standardAssetPath = standardizeAssetPath(this.packageName, assetPath);
        if (!standardAssetPath) {
          return;
        }
        if (options.type === 'vendor') {
          if (options.outputFile && options.outputFile !== '/assets/vendor.js') {
            todo(`${this.packageName} is app.importing vendor assets into a nonstandard output file ${options.outputFile}`);
          }
          app.push(standardAssetPath);
        } else if (options.type === 'test') {
          test.push(standardAssetPath);
        } else {
          todo(`${this.packageName} has a non-standard app.import type ${options.type} for asset ${assetPath}`);
        }
      });
    }
    return { app, test };
  }

  makeTree(outDir): Tree {
    if (this.categorized.app.length === 0 && this.categorized.test.length === 0) {
      return;
    }
    if (this.categorized.app.length > 0) {
      writeFileSync(join(outDir, `_implicit_imports_.js`), appImportsTemplate({ imports: this.categorized.app }), 'utf8');
    }
    if (this.categorized.test.length > 0) {
      writeFileSync(join(outDir, `_implicit_test_imports_.js`), appImportsTemplate({ imports: this.categorized.test }), 'utf8');
    }
    return new UnwatchedDir(outDir);
  }

  get meta() {
    let result = {};
    if (this.categorized.app.length > 0) {
      result['implicit-imports'] = ['_implicit_imports_'];
    }
    if (this.categorized.test.length > 0) {
      result['implicit-test-imports'] = ['_implicit_test_imports_'];
    }
    return result;
  }
}

function standardizeAssetPath(packageName, assetPath) {
  let [first, ...rest] = assetPath.split('/');
  if (first === 'vendor') {
    // our vendor tree is available via relative import
    return './vendor/' + rest.join('/');
  } else if (first === 'node_modules') {
    // our node_modules are allowed to be resolved directly
    return rest.join('/');
  } else {
    todo(`${packageName} app.imported from unknown path ${assetPath}`);
  }
}
