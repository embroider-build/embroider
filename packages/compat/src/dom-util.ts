import { dirname, relative } from 'path';
import { EmberAsset } from './app';

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
