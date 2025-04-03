import { readFileSync } from 'fs-extra';
import AddToTree from '../add-to-tree';
import V1Addon from '../v1-addon';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

export default class extends V1Addon {
  get packageMeta() {
    let result = super.packageMeta;
    result['renamed-modules'] = {
      fetch: 'ember-fetch/index.js',
    };
    return result;
  }
  get v2Tree() {
    // ember-fetch attempts to emits an AMD define into vendor.js. We instead
    // adapt it into an ES module, so it can continue accessing ember even once
    // ember is not in AMD.
    return new AddToTree(super.v2Tree, (outputPath: string) => {
      let vendorFile = resolve(outputPath, 'vendor/ember-fetch.js');
      let src = readFileSync(vendorFile, 'utf8');
      // the addon has already done "app.import('vendor/ember-fetch.js')", which
      // pushes it onto a list down inside the guts of ember-cli. If we delete
      // the file, we'll get a crash when ember-cli goes looking for it.
      // Instead, we just make it empty.
      writeFileSync(vendorFile, '');
      writeFileSync(
        resolve(outputPath, 'index.js'),
        `import Ember from 'ember';
const outputs = {};

function define(name, deps, fn) {
  if (name !== 'fetch') {
    throw new Error('bug: we were attempting to capture ember-fetch');
  }
  if (deps[0] !== 'exports' && deps[1] !== 'ember') {
    throw new Error('bug: we unexpected deps while capturing ember-fetch');
  }
  fn(outputs, Ember);
}
${src}
export default outputs.default;
export const Headers = outputs.Headers;
export const Request = outputs.Request;
export const Response = outputs.Response;
export const AbortController = outputs.AbortController;
export const AbortSignal = outputs.AbortSignal;
export const fetch = outputs.fetch;
`
      );
    });
  }
}
