import { JSDOM } from 'jsdom';

export type ImplicitSection = "implicit-scripts" | "implicit-styles" | "implicit-test-scripts" | "implicit-test-styles" | "implicit-modules" | "implicit-test-modules";

interface BaseAsset {
  // where this asset should be placed, relative to the app's root
  relativePath: string;
}

export interface OnDiskAsset extends BaseAsset {
  kind: "on-disk";

  // absolute path to where we will find it
  sourcePath: string;
}

export interface InMemoryAsset extends BaseAsset {
  kind: "in-memory";

  // the actual bits
  source: string | Buffer;
}

export interface DOMAsset extends BaseAsset {
  kind: "dom";

  // an already-parsed document
  dom: JSDOM;

  // declares that the ember app should be inserted into this asset
  insertEmberApp?: AppInsertion;
}

export type Asset = OnDiskAsset | InMemoryAsset | DOMAsset;

export interface AppInsertion {
  // whether to inside the test suite in addition to the ember app
  includeTests: true;

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
  // DO NOT CONFUSE these with controlling whether or not we will insert tests.
  // That is separately controlled via `includeTests`.
  testJavascript?: Node;
  implicitTestScripts?: Node;
  implicitTestStyles?: Node;
}

export function appInsertion(ai: Partial<AppInsertion>): AppInsertion {
  if (!ai.javascript || !ai.styles || !ai.implicitScripts || !ai.implicitStyles) {
    throw new Error(`bug: expected a complete AppInsertion`);
  }
  return ai as AppInsertion;
}
