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
    private publicAssetURL: string,
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
    let insertedLazy = false;
    let fastbootVariant = stats.variants.findIndex(v => Boolean(v.runtime === 'fastboot'));
    let supportsFastboot = stats.variants.some(v => v.runtime === 'fastboot' || v.runtime === 'all');

    for (let [src, placeholders] of this.placeholders) {
      let match = stats.entrypoints.get(src);
      if (match) {
        let firstVariant = stats.variants.findIndex((_, index) => Boolean(match!.get(index)));
        let matchingBundles = match.get(firstVariant)!;
        let matchingFastbootBundles = fastbootVariant >= 0 ? match.get(fastbootVariant) || [] : [];

        for (let placeholder of placeholders) {
          if (supportsFastboot) {
            // if there is any fastboot involved, we will emit the lazy bundles
            // right before our first script.
            insertedLazy = maybeInsertLazyBundles(insertedLazy, stats.lazyBundles, placeholder, this.publicAssetURL);
          }
          for (let [base, fastboot] of zip(matchingBundles, matchingFastbootBundles)) {
            if (!base) {
              // this bundle only exists in the fastboot variant
              let element = placeholder.start.ownerDocument.createElement('fastboot-script');
              // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
              let src = this.publicAssetURL.match(/^http/) ? '/' : this.publicAssetURL;
              element.setAttribute('src', src + fastboot);
              placeholder.insert(element);
              placeholder.insertNewline();
            } else if (!fastboot || base === fastboot) {
              // no specialized fastboot variant
              let src = this.publicAssetURL + base;
              // HACK: actually, URL in `publicAssetURL` breaks fastboot loading; only absolute path works
              // so even if there is not specialized fastboot variant, we need to add one without the URL
              let element = placeholder.insertURL(src);
              if (element && this.publicAssetURL.match(/^http/)) {
                element.setAttribute('data-fastboot-src', '/' + base);
              }
            } else {
              // we have both and they differ
              let src = this.publicAssetURL + base;
              let element = placeholder.insertURL(src);
              if (element) {
                // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
                let src = this.publicAssetURL.match(/^http/) ? '/' : this.publicAssetURL;
                element.setAttribute('data-fastboot-src', src + fastboot);
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
  entrypoints: Map<string, Map<number, string[]>>;

  // lazyBundles are tracked specifically for fastboot, so these always come
  // from the fastboot variant, if any
  lazyBundles: Set<string>;

  variants: Variant[];
}

function isAbsoluteURL(url: string) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

// we (somewhat arbitrarily) decide to put the lazy bundles before the very
// first <script> that we have rewritten
function maybeInsertLazyBundles(
  insertedLazy: boolean,
  lazyBundles: Set<string>,
  placeholder: Placeholder,
  publicAssetURL: string
): boolean {
  if (!insertedLazy && placeholder.isScript()) {
    for (let bundle of lazyBundles) {
      let element = placeholder.start.ownerDocument.createElement('fastboot-script');
      // HACK: actual URL in `publicAssetURL` breaks fastboot loading; only absolute path works
      let src = publicAssetURL.match(/^http/) ? '/' : publicAssetURL;
      element.setAttribute('src', src + bundle);
      placeholder.insert(element);
      placeholder.insertNewline();
    }
    return true;
  }
  return insertedLazy;
}
