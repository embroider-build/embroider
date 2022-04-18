import { getOrCreate } from '@embroider/shared-internals';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import partition from 'lodash/partition';
import zip from 'lodash/zip';
import Placeholder from './html-placeholder';
import { Variant } from './packager';

export class HTMLEntrypoint {
  private dom: JSDOM;
  private placeholders: Map<string, Placeholder[]> = new Map();
  modules: string[] = [];
  scripts: string[] = [];
  styles: string[] = [];

  constructor(
    private pathToVanillaApp: string,
    private rootURL: string,
    private urlForAsset: (asset: string) => string,
    public filename: string
  ) {
    this.dom = new JSDOM(readFileSync(join(this.pathToVanillaApp, this.filename), 'utf8'));

    for (let tag of this.handledStyles()) {
      let styleTag = tag as HTMLLinkElement;
      let href = styleTag.href;
      if (!isAbsoluteURL(href)) {
        let url = this.relativeToApp(href);
        this.styles.push(url);
        let placeholder = new Placeholder(styleTag);
        let list = getOrCreate(this.placeholders, url, () => []);
        list.push(placeholder);
      }
    }

    for (let scriptTag of this.handledScripts()) {
      // scriptTag.src include rootURL. Convert it to be relative to the app.
      let src = this.relativeToApp(scriptTag.src);

      if (scriptTag.type === 'module') {
        this.modules.push(src);
      } else {
        this.scripts.push(src);
      }

      let placeholder = new Placeholder(scriptTag);
      let list = getOrCreate(this.placeholders, src, () => []);
      list.push(placeholder);
    }
  }

  private relativeToApp(rootRelativeURL: string) {
    return rootRelativeURL.replace(this.rootURL, '');
  }

  private handledScripts() {
    let scriptTags = [...this.dom.window.document.querySelectorAll('script')] as HTMLScriptElement[];
    let [ignoredScriptTags, handledScriptTags] = partition(scriptTags, scriptTag => {
      return !scriptTag.src || scriptTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(scriptTag.src);
    });
    for (let scriptTag of ignoredScriptTags) {
      scriptTag.removeAttribute('data-embroider-ignore');
    }
    return handledScriptTags;
  }

  private handledStyles() {
    let styleTags = [...this.dom.window.document.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
    let [ignoredStyleTags, handledStyleTags] = partition(styleTags, styleTag => {
      return !styleTag.href || styleTag.hasAttribute('data-embroider-ignore') || isAbsoluteURL(styleTag.href);
    });
    for (let styleTag of ignoredStyleTags) {
      styleTag.removeAttribute('data-embroider-ignore');
    }
    return handledStyleTags;
  }

  // bundles maps from input asset to a per-variant map of output assets
  render(stats: BundleSummary): string {
    let insertedLazy = new Set<string>();
    let fastbootVariant = stats.variants.findIndex(v => Boolean(v.runtime === 'fastboot'));
    let supportsFastboot = stats.variants.some(v => v.runtime === 'fastboot' || v.runtime === 'all');

    for (let [src, placeholders] of this.placeholders) {
      let match = stats.entrypoints.get(src);
      if (match) {
        let firstVariant = stats.variants.findIndex((_, index) => Boolean(match!.get(index)));
        let matchingBundles = match.get(firstVariant)!;
        let matchingFastbootBundles = fastbootVariant >= 0 ? match.get(fastbootVariant) || [] : [];

        for (let placeholder of placeholders) {
          if (supportsFastboot && placeholder.isScript()) {
            // if there is any fastboot involved, we will emit the lazy bundles
            // right before our first script.

            let lazyMatch = stats.lazyBundles.get(src);
            if (lazyMatch && !insertedLazy.has(src)) {
              insertLazyJavascript(lazyMatch, placeholder, this.urlForAsset);
              insertLazyStyles(lazyMatch, placeholder, this.urlForAsset);
              insertedLazy.add(src);
            }
          }
          for (let [base, fastboot] of zip(matchingBundles, matchingFastbootBundles)) {
            if (!base) {
              // this bundle only exists in the fastboot variant
              let element = placeholder.start.ownerDocument.createElement('fastboot-script');
              element.setAttribute('src', this.urlForAsset(fastboot as string));
              placeholder.insert(element);
              placeholder.insertNewline();
            } else if (!fastboot || base === fastboot) {
              // no specialized fastboot variant
              placeholder.insertURL(this.urlForAsset(base));
            } else {
              // we have both and they differ
              let src = this.urlForAsset(base);
              let element = placeholder.insertURL(src);
              if (element) {
                element.setAttribute('data-fastboot-src', this.urlForAsset(fastboot));
              }
            }
          }
        }
      } else {
        // no match means keep the original HTML content for this placeholder.
        // (If we really wanted it empty instead, there would be matchingBundles
        // and it would be an empty list.)
        for (let placeholder of placeholders) {
          placeholder.reset();
        }
      }
    }
    return this.dom.serialize();
  }
}

export interface BundleSummary {
  // entrypoints.get(inputAsset).get(variantIndex) === outputAssets
  //
  // these are the output assets that are needed eagerly to boot the given input
  // asset
  entrypoints: Map<string, Map<number, string[]>>;

  // lazyBundles.get(inputAsset) === lazyOutputAssets
  //
  // these are the output assets that might be loaded lazyily at runtime by the
  // given input asset.
  //
  // These are tracked specifically for the fastboot variant, because that's
  // where we need to be responsble for them.
  lazyBundles: Map<string, string[]>;

  variants: Variant[];
}

function isAbsoluteURL(url: string) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

// we (somewhat arbitrarily) decide to put the lazy javascript bundles before
// the very first <script> that we have rewritten
function insertLazyJavascript(lazyBundles: string[], placeholder: Placeholder, urlForAsset: (a: string) => string) {
  for (let bundle of lazyBundles) {
    if (bundle.endsWith('.js')) {
      let element = placeholder.start.ownerDocument.createElement('fastboot-script');
      element.setAttribute('src', urlForAsset(bundle));
      placeholder.insert(element);
      placeholder.insertNewline();
    }
  }
}

function insertLazyStyles(lazyBundles: string[], placeholder: Placeholder, urlForAsset: (a: string) => string) {
  for (let bundle of lazyBundles) {
    if (bundle.endsWith('.css')) {
      let element = placeholder.start.ownerDocument.createElement('link');
      element.setAttribute('href', urlForAsset(bundle));
      element.setAttribute('rel', 'stylesheet');
      placeholder.insert(element);
      placeholder.insertNewline();
    }
  }
}
