import BroccoliPlugin, { Tree } from 'broccoli-plugin';
import { readFileSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { JSDOM } from 'jsdom';

export default class extends BroccoliPlugin {
  constructor(inputTree: Tree, private appName, private configuredPaths: any){
    super([inputTree], {});
  }

  async build() {
    let dom = new JSDOM(readFileSync(join(this.inputPaths[0], this.configuredPaths.app.html), 'utf8'));
    let scripts = [...dom.window.document.querySelectorAll('script')];

    // no custom name allowed here -- we're standardizing. It's not the final
    // output anyway, that will be up to the final stage packager.
    let appJS = scripts.find(script => script.src === this.configuredPaths.app.js);
    appJS.src = `/assets/${this.appName}.js`;

    // the vendor.js file goes away. It's not really a concern of the vanilla
    // app format to decide how to split code. Everything is in one file, and
    // the final stage packager will split.
    //
    // As an example: the out-of-the-box behavior of Webpack 4 is to split out
    // all Javascript that came from node_modules into a separate vendor bundle.
    // Which is exactly analogous to what we were doing with vendor.js anyway.
    let vendorJS = scripts.find(script => script.src === this.configuredPaths.vendor.js);
    vendorJS.remove();

    writeFileSync(join(this.outputPath, this.configuredPaths.app.html), dom.serialize(), 'utf8');
  }
}
