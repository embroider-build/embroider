import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import type { EmberAsset } from './asset';
import { makeTag, normalizeStyleLink } from './html-placeholder';

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

class Placeholder {
  static find(node: Node): Placeholder {
    let placeholder = this.immediatelyAfter(node);
    return placeholder;
  }

  static replacing(node: Node): Placeholder {
    let placeholder = this.immediatelyAfter(node);
    node.parentElement!.removeChild(node);
    return placeholder;
  }

  static immediatelyAfter(node: Node): Placeholder {
    let document = node.ownerDocument;
    let parent = node.parentElement;

    if (!document || !parent) {
      throw new Error('Cannot make Placeholder out of detached node');
    }

    let nextSibling = node.nextSibling;
    let start = document.createTextNode('');
    let end = document.createTextNode('');

    parent.insertBefore(start, nextSibling);
    parent.insertBefore(end, nextSibling);
    return new Placeholder(start, end, node);
  }

  readonly parent: HTMLElement;

  constructor(readonly start: Node, readonly end: Node, readonly reference: Node) {
    if (start.parentElement && start.parentElement === end.parentElement) {
      this.parent = start.parentElement;
    } else {
      throw new Error('Cannot make Placeholder out of detached node');
    }
  }

  clear() {
    let { start, end, parent } = this;
    while (start.nextSibling && start.nextSibling !== end) {
      parent.removeChild(start.nextSibling);
    }
  }

  insert(node: Node) {
    this.parent.insertBefore(node, this.end);
  }
}

export class PreparedEmberHTML {
  dom: JSDOM;
  javascript: Placeholder;
  styles: Placeholder;
  implicitScripts: Placeholder;
  implicitStyles: Placeholder;
  testJavascript: Placeholder;
  implicitTestScripts: Placeholder;
  implicitTestStyles: Placeholder;

  constructor(private asset: EmberAsset) {
    this.dom = new JSDOM(readFileSync(asset.sourcePath, 'utf8'));
    let html = asset.prepare(this.dom);
    this.javascript = Placeholder.replacing(html.javascript);
    this.styles = Placeholder.replacing(html.styles);
    this.implicitScripts = Placeholder.find(html.implicitScripts);
    this.implicitStyles = Placeholder.replacing(html.implicitStyles);
    this.testJavascript = html.testJavascript
      ? Placeholder.replacing(html.testJavascript)
      : Placeholder.immediatelyAfter(this.javascript.end);
    this.implicitTestScripts = html.implicitTestScripts
      ? Placeholder.replacing(html.implicitTestScripts)
      : Placeholder.immediatelyAfter(this.implicitScripts.end);
    this.implicitTestStyles = html.implicitTestStyles
      ? Placeholder.replacing(html.implicitTestStyles)
      : Placeholder.immediatelyAfter(this.implicitStyles.end);
  }

  private placeholders(): Placeholder[] {
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
    for (let range of this.placeholders()) {
      range.clear();
    }
  }

  // this takes the src relative to the application root, we adjust it so it's
  // root-relative via the configured rootURL
  insertScriptTag(
    placeholder: Placeholder,
    relativeSrc: string,
    { type, tag = 'script' }: { type?: string; tag?: string } = {}
  ) {
    let document = this.dom.window.document;
    let from = placeholder.reference.nodeType === 1 ? (placeholder.reference as HTMLElement) : undefined;
    let src = this.asset.rootURL + relativeSrc;
    let attributes: Record<string, string> = type ? { src, type } : { src };
    let newTag = makeTag(document, { from, tag, attributes });
    placeholder.insert(this.dom.window.document.createTextNode('\n'));
    placeholder.insert(newTag);
  }

  // this takes the href relative to the application root, we adjust it so it's
  // root-relative via the configured rootURL
  insertStyleLink(placeholder: Placeholder, relativeHref: string) {
    let document = this.dom.window.document;
    let from = placeholder.reference.nodeType === 1 ? (placeholder.reference as HTMLElement) : undefined;
    let href = this.asset.rootURL + relativeHref;
    let newTag = makeTag(document, { from, tag: 'link', attributes: { href } });
    normalizeStyleLink(newTag);
    placeholder.insert(this.dom.window.document.createTextNode('\n'));
    placeholder.insert(newTag);
  }
}

export function insertNewline(at: Node) {
  at.parentElement!.insertBefore(at.ownerDocument!.createTextNode('\n'), at);
}
