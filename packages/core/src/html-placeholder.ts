export function makeTag(
  document: Document,
  options: { from: HTMLElement; tag?: string; attributes?: { [name: string]: string | null } }
): HTMLElement;
export function makeTag(
  document: Document,
  options: { from?: HTMLElement; tag: string; attributes?: { [name: string]: string | null } }
): HTMLElement;
export function makeTag(
  document: Document,
  { from, tag, attributes }: { from?: HTMLElement; tag?: string; attributes?: { [name: string]: string | null } } = {}
): HTMLElement {
  if (!tag && from) {
    tag = from.tagName;
  }

  if (!tag) {
    throw new Error('Must supply one of `options.from` or `options.tag`');
  }

  let cloned = document.createElement(tag);
  let overrides = new Map(Object.entries(attributes ?? {}));

  if (from) {
    for (let { name, value: originalValue } of from.attributes) {
      let value = overrides.has(name) ? overrides.get(name)! : originalValue;
      overrides.delete(name);

      if (value === null) {
        continue;
      } else {
        cloned.setAttribute(name, value);
      }
    }
  }

  for (let [name, value] of overrides) {
    if (value !== null) {
      cloned.setAttribute(name, value);
    }
  }

  return cloned;
}

export function normalizeScriptTag(tag: HTMLElement): void {
  if (tag.getAttribute('type') === 'module') {
    // we always convert modules to scripts, dropping
    tag.removeAttribute('type');
  }
}

export function normalizeStyleLink(tag: HTMLElement): void {
  let rel = tag.getAttribute('rel');

  if (rel === null) {
    tag.setAttribute('rel', 'stylesheet');
  } else if (!rel.includes('stylesheet')) {
    tag.setAttribute('rel', `${rel} stylesheet`);
  }
}

export default class Placeholder {
  end: InDOMNode;
  start: StartNode;

  // remove the target Element from the DOM, and track where it was so we can
  // update that location later.
  constructor(private target: HTMLElement) {
    if (!target.ownerDocument || !target.parentElement) {
      throw new Error('can only construct a placeholder for an element that is in DOM');
    }
    let start = target.ownerDocument.createTextNode('');
    target.parentElement.insertBefore(start, target);
    let endNode = target.ownerDocument.createTextNode('');
    target.replaceWith(endNode);

    // Type cast is justified because start always has a nextSibling (it's
    // "end") and because we know we already inserted the node.
    this.start = start as StartNode;

    // Type cast is justified because we know we already inserted the node.
    this.end = endNode as InDOMNode;
  }

  reset() {
    this.clear();
    this.insert(this.target);
  }

  clear() {
    while (this.start.nextSibling !== this.end) {
      this.start.parentElement.removeChild(this.start.nextSibling);
    }
  }

  insert(node: Node): void {
    this.end.parentElement.insertBefore(node, this.end);
  }

  appendToHead(node: Node): void {
    this.end.ownerDocument.head.appendChild(node);
  }

  isScript(): boolean {
    return this.target.tagName === 'SCRIPT';
  }

  insertURL(url: string) {
    if (url.endsWith('.js')) {
      return this.insertScriptTag(url);
    }
    if (url.endsWith('.css')) {
      return this.insertStyleLink(url);
    }
    throw new Error(`don't know how to insertURL ${url}`);
  }

  insertScriptTag(src: string) {
    let newTag = makeTag(this.end.ownerDocument, { from: this.target, attributes: { src } });
    normalizeScriptTag(newTag);

    this.insert(newTag);
    this.insertNewline();
    return newTag;
  }

  insertStyleLink(href: string) {
    let newTag: HTMLElement;

    if (this.isScript()) {
      // Add dynamic styles from scripts to the bottom of the head, and not to where the script was,
      // to prevent FOUC when pre-rendering (FastBoot)
      newTag = makeTag(this.end.ownerDocument, {
        from: this.target,
        tag: 'link',
        attributes: { href, type: null, src: null },
      });
      normalizeStyleLink(newTag);
      this.appendToHead(newTag);
    } else {
      // Keep the new style in the same place as the original one
      newTag = makeTag(this.end.ownerDocument, { from: this.target, attributes: { href } });
      normalizeStyleLink(newTag);
      this.insert(newTag);
    }
    this.insertNewline(newTag as InDOMNode);
  }

  insertNewline(node: InDOMNode = this.end): void {
    node.parentElement.insertBefore(node.ownerDocument.createTextNode('\n'), node);
  }
}

// an html node that's definitely inserted into the DOM
interface InDOMNode extends Node {
  parentElement: HTMLElement;
  ownerDocument: Document;
}

// an html node that definitely has a next sibling.
interface StartNode extends InDOMNode {
  nextSibling: InDOMNode & ChildNode;
}
