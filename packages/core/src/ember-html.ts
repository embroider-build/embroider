import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { EmberAsset } from './asset';

export interface EmberHTML {
  // each of the Nodes in here points at where we should insert the
  // corresponding parts of the ember app. The Nodes themselves will be
  // replaced, so provide placeholders.

  // these are mandatory, the Ember app may need to put things into them.
  javascript: Node;
  styles: Node;
  implicitScripts: Node;
  implicitStyles: Node;

  // these are optional because you *may* choose to stick your implicit test
  // things into specific locations (which we need for backward-compat). But you
  // can leave these off and we will simply put them in the same places as the
  // non-test things.
  //
  // Do not confuse these with controlling whether or not we will insert tests.
  // That is separately controlled via `includeTests`.
  testJavascript?: Node;
  implicitTestScripts?: Node;
  implicitTestStyles?: Node;
}

class NodeRange {
  end: Node;
  start: Node;
  constructor(initial: Node) {
    this.start = initial.ownerDocument!.createTextNode('');
    initial.parentElement!.insertBefore(this.start, initial);
    this.end = initial;
  }
  clear() {
    while (this.start.nextSibling !== this.end) {
      this.start.parentElement!.removeChild(this.start.nextSibling!);
    }
  }
  insert(node: Node) {
    this.end.parentElement!.insertBefore(node, this.end);
  }
}

function immediatelyAfter(node: Node) {
  let newMarker = node.ownerDocument!.createTextNode('');
  node.parentElement!.insertBefore(newMarker, node.nextSibling);
  return new NodeRange(newMarker);
}

export class PreparedEmberHTML {
  dom: JSDOM;
  origin: JSDOM;
  javascript: NodeRange;
  styles: NodeRange;
  implicitScripts: NodeRange;
  implicitStyles: NodeRange;
  testJavascript: NodeRange;
  implicitTestScripts: NodeRange;
  implicitTestStyles: NodeRange;

  constructor(private asset: EmberAsset) {
    let source = readFileSync(asset.sourcePath, 'utf8');
    this.dom = new JSDOM(source);
    this.origin = new JSDOM(source);
    let html = asset.prepare(this.dom);
    this.javascript = new NodeRange(html.javascript);
    this.styles = new NodeRange(html.styles);
    this.implicitScripts = new NodeRange(html.implicitScripts);
    this.implicitStyles = new NodeRange(html.implicitStyles);
    this.testJavascript = html.testJavascript ? new NodeRange(html.testJavascript) : immediatelyAfter(html.javascript);
    this.implicitTestScripts = html.implicitTestScripts
      ? new NodeRange(html.implicitTestScripts)
      : immediatelyAfter(html.implicitScripts);
    this.implicitTestStyles = html.implicitTestStyles
      ? new NodeRange(html.implicitTestStyles)
      : immediatelyAfter(html.implicitStyles);
  }

  private allRanges(): NodeRange[] {
    return [
      this.javascript,
      this.styles,
      this.implicitScripts,
      this.implicitStyles,
      this.implicitTestScripts,
      this.implicitTestStyles,
      this.testJavascript,
    ];
  }

  clear() {
    for (let range of this.allRanges()) {
      range.clear();
    }
  }

  // this takes the src relative to the application root, we adjust it so it's
  // root-relative via the configured rootURL
  insertScriptTag(location: NodeRange, relativeSrc: string, opts?: { type?: string; tag?: string }) {
    let newTag = this.dom.window.document.createElement(opts && opts.tag ? opts.tag : 'script');
    let src = this.asset.rootURL + relativeSrc;
    let origin = this.origin.window.document.querySelector(`script[src="${src}"]`);    
    if (origin) {
      for (let { name, value } of [...origin.attributes]) {
        newTag.setAttribute(name, value);
      }
    }
    newTag.setAttribute('src', src);
    if (opts && opts.type) {
      newTag.setAttribute('type', opts.type);
    }
    location.insert(this.dom.window.document.createTextNode('\n'));
    location.insert(newTag);
  }

  // this takes the href relative to the application root, we adjust it so it's
  // root-relative via the configured rootURL
  insertStyleLink(location: NodeRange, relativeHref: string) {
    let newTag = this.dom.window.document.createElement('link');
    let href = this.asset.rootURL + relativeHref;
    let origin = this.origin.window.document.querySelector(`link[href="${href}"][rel="stylesheet"]`);    
    if (origin) {
      for (let { name, value } of [...origin.attributes]) {
        newTag.setAttribute(name, value);
      }
    }
    newTag.rel = 'stylesheet';
    newTag.href = href;
    location.insert(this.dom.window.document.createTextNode('\n'));
    location.insert(newTag);
  }
}

export function insertNewline(at: Node) {
  at.parentElement!.insertBefore(at.ownerDocument!.createTextNode('\n'), at);
}
