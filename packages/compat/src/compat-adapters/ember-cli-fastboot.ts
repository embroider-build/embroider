import V1Addon from '../v1-addon';
import Plugin, { Tree } from 'broccoli-plugin';
import { readJSONSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';

export default class EmberCliFastboot extends V1Addon {
  customizes(...trees: string[]): boolean {
    return trees.some(tree => {
      if (tree === 'treeForPublic') {
        // we ignore the custom treeForPublic, because Embroider natively
        // understands each addon's fastboot tree and we don't want to bother
        // rebuilding them all only to ignore them after this point.
        return false;
      } else {
        return super.customizes(tree);
      }
    });
  }
  // there is one thing from treeForPublic that we do want, which is grabbing
  // the fastboot-generated package.json file so we can get our hands on the
  // fastboot config.
  get v2Trees() {
    let trees = super.v2Trees;

    trees.push(new RewriteManifest(this.addonInstance._buildFastbootConfigTree(this.rootTree), this.expectedFiles()));
    return trees;
  }

  // these are the default files that ember-cli-fastbot includes in its appFiles
  // and vendorFiles that we know are already accounted for by the standard
  // embroider build
  private expectedFiles(): string[] {
    let outputPaths = this.addonInstance.app.options.outputPaths;
    function stripLeadingSlash(filePath: string) {
      return filePath.replace(/^\//, '');
    }
    let appFilePath = stripLeadingSlash(outputPaths.app.js);
    let appFastbootFilePath = appFilePath.replace(/\.js$/, '') + '-fastboot.js';
    let vendorFilePath = stripLeadingSlash(outputPaths.vendor.js);

    // ember-auto-import emits this into the fastboot manifest. But embroider
    // subsumes all of ember-auto-import, so we take responsibility for this
    // stuff directly.
    let autoImportPath = 'assets/auto-import-fastboot.js';

    return [appFilePath, appFastbootFilePath, vendorFilePath, autoImportPath];
  }
}

class RewriteManifest extends Plugin {
  constructor(tree: Tree, private expectedFiles: string[]) {
    super([tree], { annotation: 'embroider-compat-adapter-ember-cli-fastboot' });
  }
  build() {
    let json = readJSONSync(join(this.inputPaths[0], 'package.json'));

    let extraAppFiles = (json.fastboot.manifest.appFiles as string[]).filter(
      file => !this.expectedFiles.includes(file)
    );

    let extraVendorFiles = (json.fastboot.manifest.vendorFiles as string[]).filter(
      file => !this.expectedFiles.includes(file)
    );

    // we're using our own new style of fastboot manifest that loads everything
    // via the HTML. HTML is better understood by tools beyond Ember and
    // Fastboot, so it's more robust to going through third-party bundlers
    // without breaking. We can get by with only a very small extension over
    // purely standards-compliant HTML.
    json.fastboot.manifest = {
      htmlEntrypoint: 'index.html',
    };

    // this is a message to Embroider stage2 (in app.ts), because we need it to
    // arrange the one special extension to HTML that we need: fastboot-only
    // script tags.
    //
    // Fastboot only javascript *modules* don't need any magic, because our
    // macro system can guard them. That is the preferred way to have
    // fastboot-only code. But for backward compatibility, we also support
    // fastboot-only *scripts*, and those do need a bit of magic, in the form of
    // <fastboot-script> tags.
    json['embroider-fastboot'] = {
      extraAppFiles,
      extraVendorFiles,
    };

    outputJSONSync(join(this.outputPath, '_fastboot_', 'package.json'), json, { spaces: 2 });
  }
}
