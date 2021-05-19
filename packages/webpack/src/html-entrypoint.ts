import { getOrCreate } from '@embroider/core';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import partition from 'lodash/partition';
import zip from 'lodash/zip';
import Placeholder from './html-placeholder';
import { StatSummary } from './stat-summary';

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
  render(stats: StatSummary): string {
    let insertedLazy = false;
    let fastbootVariant = stats.variants.findIndex(v => Boolean(v.runtime === 'fastboot'));
    let supportsFastboot = stats.variants.some(v => v.runtime === 'fastboot' || v.runtime === 'all');

    // We want to insert all CSS that webpack extracted before the CSS that was
    // specified in the HTML. So, first we walk through our placeholders sorting
    // them, and removing any that don't match content in the stats.
    let css = [];
    let extractedCss = [];
    let js = [];

    for (let [src, placeholders] of this.placeholders) {
      let match = stats.entrypoints.get(src);
      if (match) {
        let firstVariant = stats.variants.findIndex((_, index) => Boolean(match!.get(index)));
        let matchingBundles = match.get(firstVariant)!;

        if (src.endsWith('.css')) {
          // CSS specified in the HTML, so associate each matching bundle with
          // the placeholders
          for (let bundle of matchingBundles) {
            css.push({ bundle, placeholders });
          }
        } else {
          // JS, so collect the matching bundles & fastboot bundles according to
          // whether they are CSS or JS
          let matchingFastbootBundles = fastbootVariant >= 0 ? match.get(fastbootVariant) || [] : [];
          for (let [base, fastboot] of zip(matchingBundles, matchingFastbootBundles)) {
            if (base?.endsWith('.css')) {
              // Extracted CSS, so we know there is only a base and no fastboot
              // bundle. Store off the first JS placeholder so that in the edge
              // case where there are no CSS placeholders on the whole document,
              // we can just insert the extracted CSS before the first instance
              // of the JS script element from which it was extracted
              extractedCss.push({ bundle: base, placeholder: placeholders[0] });
            } else {
              // JS, so might have base and/or fastboot bundle
              js.push({ base, fastboot, placeholders });
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

    // Handle extracted CSS first so it will end up before HTML-specified CSS
    if (extractedCss.length > 0) {
      // Find the first (in DOM order) CSS placeholder
      let firstCssPlaceholder;
      for (let { placeholders } of css) {
        for (let placeholder of placeholders) {
          if (
            !firstCssPlaceholder ||
            firstCssPlaceholder.start.compareDocumentPosition(placeholder.start) &
              this.dom.window.Node.DOCUMENT_POSITION_PRECEDING
          ) {
            firstCssPlaceholder = placeholder;
          }
        }
      }

      // Now insert the extracted CSS into the first CSS placeholder (or if
      // there are none, which would be kinda weird, before the placeholder
      // from the JS from which the CSS was extracted)
      for (let { bundle, placeholder } of extractedCss) {
        let src = this.publicAssetURL + bundle;
        if (firstCssPlaceholder) {
          firstCssPlaceholder.insertURL(src);
        } else {
          placeholder.insertURL(src);
        }
      }
    }

    // Handle HTML-specified CSS
    for (let { bundle, placeholders } of css) {
      let src = this.publicAssetURL + bundle;
      for (let placeholder of placeholders) {
        placeholder.insertURL(src);
      }
    }

    // Handle JS
    for (let { base, fastboot, placeholders } of js) {
      for (let placeholder of placeholders) {
        if (supportsFastboot) {
          // if there is any fastboot involved, we will emit the lazy bundles
          // right before our first script.
          insertedLazy = maybeInsertLazyBundles(insertedLazy, stats.lazyBundles, placeholder, this.publicAssetURL);
        }

        if (!base) {
          // this bundle only exists in the fastboot variant
          let element = placeholder.start.ownerDocument.createElement('fastboot-script');
          element.setAttribute('src', this.publicAssetURL + fastboot);
          placeholder.insert(element);
          placeholder.insertNewline();
        } else if (!fastboot || base === fastboot) {
          // no specialized fastboot variant
          let src = this.publicAssetURL + base;
          placeholder.insertURL(src);
        } else {
          // we have both and they differ
          let src = this.publicAssetURL + base;
          let element = placeholder.insertURL(src);
          if (element) {
            element.setAttribute('data-fastboot-src', this.publicAssetURL + fastboot);
          }
        }
      }
    }
    return this.dom.serialize();
  }
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
      element.setAttribute('src', publicAssetURL + bundle);
      placeholder.insert(element);
      placeholder.insertNewline();
    }
    return true;
  }
  return insertedLazy;
}
