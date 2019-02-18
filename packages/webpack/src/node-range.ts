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
