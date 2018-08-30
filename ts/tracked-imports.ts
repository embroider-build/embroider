import { todo } from './messages';
import { UnwatchedDir } from 'broccoli-source';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import { compile } from './js-handlebars';

const appImportsTemplate = compile(`{{#each imports as |import|}}
import '{{js-string-escape import}}';
{{/each}}`);

export interface TrackedImport {
  assetPath: string;
  options: { type: string, outputFile: string | undefined };
}

export function categorizedImports(packageName: string, trackedImports: TrackedImport[]) : { app: string[], test: string[] } {
  let app = [];
  let test = [];

  trackedImports.forEach(({ assetPath, options }) => {
    let standardAssetPath = standardizeAssetPath(packageName, assetPath);
    if (!standardAssetPath) {
      return;
    }
    if (options.type === 'vendor') {
      if (options.outputFile && options.outputFile !== '/assets/vendor.js') {
        todo(`${packageName} is app.importing vendor assets into a nonstandard output file ${options.outputFile}`);
      }
      app.push(standardAssetPath);
    } else if (options.type === 'test') {
      test.push(standardAssetPath);
    } else {
      todo(`${packageName} has a non-standard app.import type ${options.type} for asset ${assetPath}`);
    }
  });

  return { app, test };
}

export function trackedImportTree(packageName: string, trackedImports: TrackedImport[], outDir: string) {
  if (!trackedImports) {
    return;
  }

  let { app, test } = categorizedImports(packageName, trackedImports);

  if (app.length === 0 && test.length === 0) {
    return;
  }
  if (app.length > 0) {
    writeFileSync(join(outDir, `_implicit_imports_.js`), appImportsTemplate({ imports: app }), 'utf8');
  }
  if (test.length > 0) {
    writeFileSync(join(outDir, `_implicit_test_imports_.js`), appImportsTemplate({ imports: test }), 'utf8');
  }
  return new UnwatchedDir(outDir);
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
