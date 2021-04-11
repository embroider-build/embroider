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

  insert(node: Node) {
    this.end.parentElement.insertBefore(node, this.end);
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
    let newTag = this.end.ownerDocument.createElement('script');
    for (let { name, value } of [...this.target.attributes]) {
      if (name === 'type' && value === 'module') {
        // we always convert modules to scripts
        continue;
      }
      // all other attributes are copied forward unchanged
      newTag.setAttribute(name, value);
    }
    newTag.src = src;
    this.insert(newTag);
    this.insertNewline();
    return newTag;
  }

  insertStyleLink(href: string) {
    let newTag = this.end.ownerDocument.createElement('link');
    newTag.href = href;
    newTag.rel = 'stylesheet';
    this.insert(newTag);
    this.insertNewline();
  }

  insertNewline() {
    this.end.parentElement.insertBefore(this.end.ownerDocument.createTextNode('\n'), this.end);
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
