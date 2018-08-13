import { todo } from './messages';
import { UnwatchedDir } from 'broccoli-source';
import { writeFileSync } from 'fs-extra';
import { join } from 'path';
import { compile } from './js-handlebars';

const appImportsTemplate = compile(`{{#each imports as |import|}}
import '{{js-string-escape import}}';
{{/each}}`);

interface TrackedImport {
  assetPath: string;
  options: { type: string, outputFile: string | undefined };
}

export function trackedImportTree(packageName: string, trackedImports: TrackedImport[], outDir: string) {
  if (!trackedImports) {
    return;
  }

  let appImports = [];
  let testImports = [];

  trackedImports.forEach(({ assetPath, options }) => {
    let standardAssetPath = standardizeAssetPath(packageName, assetPath);
    if (!standardAssetPath) {
      return;
    }
    if (options.type === 'vendor') {
      if (options.outputFile && options.outputFile !== '/assets/vendor.js') {
        todo(`${packageName} is app.importing vendor assets into a nonstandard output file ${options.outputFile}`);
      }
      appImports.push(standardAssetPath);
    } else if (options.type === 'test') {
      testImports.push(standardAssetPath);
    } else {
      todo(`${packageName} has a non-standard app.import type ${options.type} for asset ${assetPath}`);
    }
  });
  if (appImports.length === 0 && testImports.length === 0) {
    return;
  }
  if (appImports.length > 0) {
    writeFileSync(join(outDir, `_implicit_imports_.js`), appImportsTemplate({ imports: appImports }), 'utf8');
  }
  if (testImports.length > 0) {
    writeFileSync(join(outDir, `_implicit_test_imports_.js`), appImportsTemplate({ imports: testImports }), 'utf8');
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
