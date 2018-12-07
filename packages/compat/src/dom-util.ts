import { dirname, relative } from 'path';
import { EmberAsset } from './app';
import { JSDOM } from 'jsdom';

export function insertNewline(at: Node) {
  at.parentElement!.insertBefore(
    at.ownerDocument!.createTextNode("\n"),
    at
  );
}

export function insertScriptTag(asset: EmberAsset, location: Node, relativeSrc: string) {
  let newTag = asset.dom.window.document.createElement('script');
  newTag.src = relative(dirname(asset.relativePath), relativeSrc);
  insertNewline(location);
  location.parentElement!.insertBefore(newTag, location);
  return newTag;
}

export function insertStyleLink(asset: EmberAsset, location: Node, relativeHref: string) {
  let newTag = asset.dom.window.document.createElement('link');
  newTag.rel = "stylesheet";
  newTag.href = relative(dirname(asset.relativePath), relativeHref);
  insertNewline(location);
  location.parentElement!.insertBefore(newTag, location);
  return newTag;
}

export function maybeReplace(dom: JSDOM, element: Element | undefined): Node | undefined {
  if (element) {
    return definitelyReplace(dom, element, "", "");
  }
}

export function definitelyReplace(dom: JSDOM, element: Element | undefined, description: string, file: string): Node {
  if (!element) {
    throw new Error(`could not find ${description} in ${file}`);
  }
  let placeholder = dom.window.document.createComment('');
  element.replaceWith(placeholder);
  return placeholder;
}

export function stripInsertionMarkers(asset: EmberAsset) {
  let nodes = [
    asset.javascript,
    asset.styles,
    asset.implicitScripts,
    asset.implicitStyles,
    asset.testJavascript,
    asset.implicitTestScripts,
    asset.implicitTestStyles
  ];
  for (let node of nodes) {
    if (node && node.parentElement) {
        node.parentElement.removeChild(node);
    }
  }
}
