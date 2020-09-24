import { transform, TransformOptions } from '@babel/core';
import { readJSONSync, readFileSync } from 'fs-extra';
import { join } from 'path';
import { argv } from 'process';

export async function transpile(appDir: string, fileLocalPath: string): Promise<string> {
  let pkg = readJSONSync(join(appDir, 'package.json'));
  let config = (await import(join(appDir, pkg['ember-addon'].babel.filename))).default;
  let filename = join(appDir, fileLocalPath);
  let src = readFileSync(filename, 'utf8');
  return transform(src, Object.assign({ filename }, config) as TransformOptions)!.code!;
}

if (require.main === module) {
  if (argv.length < 4) {
    console.log(
      `
    Usage:
      node babel-debug-util.js [pathToAppOutputDir] [localPathToFile]

      Given an app that has been prepared by Embroider (the stage2 output)
      and the local path to a JS file within that app, run the app's babel
      config on that file and print the results.
  `
    );
    process.exit(-1);
  }

  transpile(process.argv[2], process.argv[3])
    .then(src => {
      console.log(src);
    })
    .catch(err => {
      console.log(err);
      process.exit(-1);
    });
}
