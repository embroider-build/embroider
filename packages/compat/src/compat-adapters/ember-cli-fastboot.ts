import V1Addon from '../v1-addon';
import Plugin from 'broccoli-plugin';
import type { Node } from 'broccoli-node-api';
import { readJSONSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import writeFile from 'broccoli-file-creator';
import { Memoize } from 'typescript-memoize';
import bind from 'bind-decorator';
import type { AddonMeta } from '@embroider/core';

export default class EmberCliFastboot extends V1Addon {
  customizes(...trees: string[]): boolean {
    return trees.some(tree => {
      if (tree === 'treeForPublic') {
        // This is an optimization. It means we won't bother running
        // ember-cli-fastboot's custom treeForPublic at all. We don't actually
        // want *most* of what's in there, because embroider natively
        // understands how to build each addon's treeForFastboot.
        //
        // But we do want *some*, so we handle those specific bits below in
        // v2Trees.
        return false;
      } else {
        return super.customizes(tree);
      }
    });
  }
  get v2Trees() {
    let trees = super.v2Trees;

    // We want to grab the fastboot config and rewrite it. We're going to strip
    // out the expectedFiles that we know are already accounted for, and we're
    // going to add app-factory.js which we know is not.
    trees.push(
      new RewriteManifest(this.addonInstance._buildFastbootConfigTree(this.rootTree), this.scriptFilter, [
        'ember-cli-fastboot/app-factory.js',
      ])
    );

    // We also still need to emit the fastboot app factory module. This emits
    // the actual file into our package.
    trees.push(writeFile('public/app-factory.js', this.appFactoryModule));

    return trees;
  }

  get packageMeta() {
    let meta = super.packageMeta;
    if (!meta['public-assets']) {
      meta['public-assets'] = {};
    }
    // we need to list app-factory.js as a public asset so it will make it's way
    // into the app's final dist.
    meta['public-assets']['./public/app-factory.js'] = 'ember-cli-fastboot/app-factory.js';
    return meta;
  }

  // these are the default files that ember-cli-fastbot includes in its appFiles
  // and vendorFiles that we know are already accounted for by the standard
  // embroider build
  @Memoize()
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

    // the compat adapter for ember-asset-loader has already removed the code
    // that reads from this file. And this file fails to get generated because
    // we don't run ember-asset-loader's "all" postprocess tree. So we need to
    // remove it here so it doesn't try to load.
    let nodeAssetManifest = 'assets/node-asset-manifest.js';

    return [appFilePath, appFastbootFilePath, vendorFilePath, autoImportPath, nodeAssetManifest];
  }

  @bind
  private scriptFilter(file: string): boolean {
    // we can drop all of engines-dist here because engines are handled natively
    // by embroider (the engine code is part of the regular module graph)
    return !this.expectedFiles().includes(file) && !file.startsWith('engines-dist/');
  }

  @Memoize()
  private get appFactoryModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fastbootAppFactoryModule = require(join(this.root, 'lib/utilities/fastboot-app-factory-module.js'));
    return fastbootAppFactoryModule(this.addonInstance._name, false);
  }
}

class RewriteManifest extends Plugin {
  constructor(tree: Node, private scriptFilter: (file: string) => boolean, private extraAppFiles: string[]) {
    super([tree], {
      annotation: 'embroider-compat-adapter-ember-cli-fastboot',
      persistentOutput: true,
      needsCache: false,
    });
  }
  build() {
    let json = readJSONSync(join(this.inputPaths[0], 'package.json'));

    let extraAppFiles = (json.fastboot.manifest.appFiles as string[]).filter(this.scriptFilter);

    for (let file of this.extraAppFiles) {
      extraAppFiles.push(file);
    }

    let extraVendorFiles = (json.fastboot.manifest.vendorFiles as string[]).filter(this.scriptFilter);

    // we're using our own new style of fastboot manifest that loads everything
    // via the HTML. HTML is better understood by tools beyond Ember and
    // Fastboot, so it's more robust to going through third-party bundlers
    // without breaking. We can get by with only a very small extension over
    // purely standards-compliant HTML.
    json.fastboot = {
      schemaVersion: 5,
      htmlEntrypoint: 'index.html',
      moduleWhitelist: json.fastboot.moduleWhitelist,
      hostWhitelist: json.fastboot.hostWhitelist,
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

    // because we contain a subdir with its own package.json, that subdir
    // becomes a "package" from emroider's perspective, and if we want it to get
    // treated as ember code it needs to have v2 addon metadata
    json.keywords = [...(json.keywords ?? []), 'ember-addon'];
    let meta: AddonMeta = {
      version: 2,
      'auto-upgraded': true,
    };
    json['ember-addon'] = meta;

    outputJSONSync(join(this.outputPath, '_fastboot_', 'package.json'), json, { spaces: 2 });
  }
}
