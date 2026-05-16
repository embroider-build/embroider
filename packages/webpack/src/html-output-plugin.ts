import type { Compiler, Compilation, EntryObject } from 'webpack';
import { JSDOM } from 'jsdom';
import fs from 'fs-extra';
const { readFileSync, existsSync, removeSync, outputFileSync } = fs;
import { join, dirname, posix } from 'path';
import { createHash } from 'crypto';
import { ResolverLoader, virtualContent } from '@embroider/core';
import { applyContentFor } from './content-for';
import { resolveVirtual } from './virtual-resolve';

// These are the `@embroider/virtual/*` references that, in vite, are emitted
// as raw assets by the resolver plugin's `buildEnd` hook (rather than being
// bundled). We do the same here instead of pushing them through webpack.
const RAW_VIRTUAL = new Set([
  '@embroider/virtual/vendor.js',
  '@embroider/virtual/vendor.css',
  '@embroider/virtual/test-support.js',
  '@embroider/virtual/test-support.css',
]);

type Handled =
  // the first module-script of an html page: gets the page's single webpack
  // entry (all the page's module scripts as ordered imports). One entry per
  // page == one runtime per page, so singletons are instantiated once, the
  // same way rollup/vite treat an html document.
  | { kind: 'js-entry'; entryName: string; el: HTMLElement }
  // any further module-scripts on the same page: their code is already part
  // of the page entry (in order), so the tag is just removed.
  | { kind: 'js-consumed'; el: HTMLElement }
  // a non-module, non-resolver-virtual reference (e.g. /@embroider/virtual/app.css).
  // The underlying file is emitted by AssetsPlugin (from a v2 addon's
  // public-assets), exactly like vite's `assets` plugin does. We just rewrite
  // the url to be publicAssetURL-relative.
  | { kind: 'asset'; request: string; el: HTMLElement }
  | { kind: 'raw-virtual'; specifier: string; el: HTMLElement; isStyle: boolean };

interface HtmlRecord {
  htmlPath: string; // e.g. "index.html" or "tests/index.html"
  dom: JSDOM;
  handled: Handled[];
  generatedFiles: string[];
}

export interface HtmlState {
  appRoot: string;
  publicAssetURL: string;
  records: HtmlRecord[];
  // set by classicEmberSupport(); when false (fully-v2 app using only ember())
  // there is no compat prebuild and nothing to substitute.
  applyContentFor: boolean;
}

function isAbsoluteURL(url: string) {
  return /^(?:[a-z]+:)?\/\//i.test(url);
}

// Support the common eager forms used by ember app/test index.html:
//   import.meta.glob("./**/*.{js,gjs,gts}", { eager: true });
//   import.meta.glob('./**/*.js', { eager: true });
function transformImportMetaGlob(code: string): string {
  return code.replace(
    /import\.meta\.glob\(\s*(['"])(.+?)\1\s*,\s*\{\s*eager\s*:\s*true\s*\}\s*\)/g,
    (_match, _q, pattern: string) => {
      let recursive = pattern.includes('**');
      let base = pattern.split('*')[0] || './';
      if (!base.startsWith('.')) {
        base = './' + base;
      }
      let extMatch = pattern.match(/\{([^}]+)\}$|\.([A-Za-z0-9]+)$/);
      let exts: string[] = [];
      if (extMatch) {
        if (extMatch[1]) {
          exts = extMatch[1].split(',').map(s => s.trim());
        } else if (extMatch[2]) {
          exts = [extMatch[2]];
        }
      }
      let regex = exts.length ? `/\\.(?:${exts.join('|')})$/` : `/.*/`;
      // exclude our own generated entry file so the context doesn't recurse
      // into the very module it's being evaluated from.
      return `(function(){var __g=require.context(${JSON.stringify(
        base
      )},${recursive},${regex});__g.keys().filter(function(k){return k.indexOf('.embroider-webpack-')===-1;}).forEach(__g);return __g;})()`;
    }
  );
}

function fingerprint(content: string | Buffer, filename: string): string {
  let hash = createHash('md5').update(content).digest('hex');
  let parts = filename.split('.');
  parts.splice(parts.length - 1, 0, hash);
  return parts.join('.');
}

// Synchronous discovery of html entrypoints. Must run *after* the compat
// prebuild (so resolver.json / content-for.json exist). Mutates `state` and
// returns the webpack entry object.
export function discoverHtmlEntrypoints(state: HtmlState, includeTests: boolean): EntryObject {
  const { appRoot } = state;
  const entry: EntryObject = {};
  state.records = [];

  let htmlPaths = ['index.html'];
  if (includeTests && existsSync(join(appRoot, 'tests/index.html'))) {
    htmlPaths.push('tests/index.html');
  }

  for (let htmlPath of htmlPaths) {
    let fullPath = join(appRoot, htmlPath);
    if (!existsSync(fullPath)) {
      continue;
    }
    let htmlBase = htmlPath.replace(/[^a-zA-Z0-9]+/g, '_');
    let source = readFileSync(fullPath, 'utf8');
    if (state.applyContentFor) {
      source = applyContentFor(source, htmlPath, appRoot);
    }
    let dom = new JSDOM(source);
    let doc = dom.window.document;
    let record: HtmlRecord = { htmlPath, dom, handled: [], generatedFiles: [] };
    let idx = 0;
    let moduleScripts: HTMLElement[] = [];
    let moduleImports: string[] = [];

    // stylesheets
    for (let link of [...doc.querySelectorAll('link[rel*="stylesheet"]')] as HTMLLinkElement[]) {
      let href = link.getAttribute('href');
      if (!href || link.hasAttribute('data-embroider-ignore') || isAbsoluteURL(href)) {
        link.removeAttribute('data-embroider-ignore');
        continue;
      }
      let request = href.replace(/^\//, '');
      if (RAW_VIRTUAL.has(request)) {
        record.handled.push({ kind: 'raw-virtual', specifier: request, el: link, isStyle: true });
      } else {
        // e.g. /@embroider/virtual/app.css - a public asset of the synthesized
        // styles addon, emitted by AssetsPlugin.
        record.handled.push({ kind: 'asset', request, el: link });
      }
    }

    // scripts
    for (let script of [...doc.querySelectorAll('script')] as HTMLScriptElement[]) {
      let src = script.getAttribute('src');
      if (script.hasAttribute('data-embroider-ignore') || (src && isAbsoluteURL(src))) {
        script.removeAttribute('data-embroider-ignore');
        continue;
      }
      let isModule = script.getAttribute('type') === 'module';
      if (isModule) {
        let importPath: string;
        if (src) {
          importPath = src.startsWith('/') ? join(appRoot, src.slice(1)) : join(dirname(fullPath), src);
        } else {
          // externalize the inline module so webpack can treat it as an entry
          // import. It is written as a sibling of the html file so its
          // relative imports resolve exactly as they did inline.
          let genFile = join(dirname(fullPath), `.embroider-webpack-${htmlBase}__${idx++}.js`);
          outputFileSync(genFile, transformImportMetaGlob(script.textContent ?? ''));
          record.generatedFiles.push(genFile);
          importPath = genFile;
        }
        moduleScripts.push(script);
        moduleImports.push(importPath);
      } else if (src) {
        let request = src.replace(/^\//, '');
        if (RAW_VIRTUAL.has(request)) {
          record.handled.push({ kind: 'raw-virtual', specifier: request, el: script, isStyle: false });
        }
        // non-virtual, non-module scripts with a src are left untouched
      }
    }

    if (moduleScripts.length > 0) {
      let entryName = htmlBase;
      entry[entryName] = { import: moduleImports };
      record.handled.push({ kind: 'js-entry', entryName, el: moduleScripts[0] });
      for (let el of moduleScripts.slice(1)) {
        record.handled.push({ kind: 'js-consumed', el });
      }
    }

    state.records.push(record);
  }

  return entry;
}

export class HtmlOutputPlugin {
  constructor(private state: HtmlState) {}

  apply(compiler: Compiler) {
    const resolverLoader = new ResolverLoader(this.state.appRoot);

    compiler.hooks.thisCompilation.tap('embroider-html-output', (compilation: Compilation) => {
      const { Compilation, sources } = compiler.webpack;

      // Emit the raw virtual assets (vendor.js/css, test-support.js/css) the
      // same way vite's resolver plugin emits them in buildEnd.
      compilation.hooks.processAssets.tapPromise(
        {
          name: 'embroider-html-output',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async () => {
          let emittedRaw = new Map<string, string>();
          for (let record of this.state.records) {
            for (let h of record.handled) {
              if (h.kind !== 'raw-virtual' || emittedRaw.has(h.specifier)) {
                continue;
              }
              let virtual = await resolveVirtual(resolverLoader.resolver, h.specifier, this.state.appRoot);
              if (!virtual) {
                continue;
              }
              let { src } = virtualContent(virtual, resolverLoader.resolver);
              let ext = h.isStyle ? 'css' : 'js';
              let outName = `assets/${fingerprint(src, `${posix.basename(h.specifier)}.${ext}`)}`;
              if (!compilation.getAsset(outName)) {
                compilation.emitAsset(outName, new sources.RawSource(src));
              }
              emittedRaw.set(h.specifier, outName);
            }
          }
          (compilation as any)._embroiderRawVirtual = emittedRaw;
        }
      );

      // Render the final HTML once all assets are known.
      compilation.hooks.processAssets.tap(
        {
          name: 'embroider-html-output',
          stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        () => {
          let emittedRaw: Map<string, string> = (compilation as any)._embroiderRawVirtual ?? new Map();
          let base = this.state.publicAssetURL;

          for (let record of this.state.records) {
            for (let h of record.handled) {
              if (h.kind === 'raw-virtual') {
                let out = emittedRaw.get(h.specifier);
                if (out) {
                  replaceTag(record.dom, h.el, [base + out]);
                }
                continue;
              }
              if (h.kind === 'asset') {
                // emitted by AssetsPlugin from a v2 addon's public-assets
                replaceTag(record.dom, h.el, [base + h.request]);
                continue;
              }
              if (h.kind === 'js-consumed') {
                // its code is already part of the page's single entry
                replaceTag(record.dom, h.el, []);
                continue;
              }
              let ep = compilation.entrypoints.get(h.entryName);
              let files = ep ? ep.getFiles() : [];
              let urls = files.map(f => base + f);
              replaceTag(record.dom, h.el, urls);
            }

            compilation.emitAsset(record.htmlPath, new sources.RawSource(record.dom.serialize()));
          }
        }
      );
    });

    // Clean up the temporary generated entry files.
    compiler.hooks.done.tap('embroider-html-output', () => {
      for (let record of this.state.records) {
        for (let f of record.generatedFiles) {
          removeSync(f);
        }
      }
    });
  }
}

function replaceTag(dom: JSDOM, el: HTMLElement, urls: string[]) {
  let doc = dom.window.document;
  let parent = el.parentElement;
  if (!parent) {
    return;
  }
  let frag = doc.createDocumentFragment();
  for (let url of urls) {
    let clean = url.split('?')[0].split('#')[0];
    if (clean.endsWith('.css')) {
      let link = doc.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', url);
      frag.appendChild(link);
      frag.appendChild(doc.createTextNode('\n'));
    } else if (clean.endsWith('.js')) {
      let script = doc.createElement('script');
      script.setAttribute('src', url);
      frag.appendChild(script);
      frag.appendChild(doc.createTextNode('\n'));
    }
  }
  parent.replaceChild(frag, el);
}
