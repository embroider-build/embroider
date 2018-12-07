import { JSDOM } from "jsdom";
import { EmberHTML } from "./ember-html";

export type ImplicitAssetType = "implicit-scripts" | "implicit-styles" | "implicit-test-scripts" | "implicit-test-styles";

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

// This represents an HTML entrypoint to the Ember app
export interface EmberAsset extends BaseAsset {
  kind: "ember";

  // absolute path to where we will find the html file
  sourcePath: string;

  // whether we should include the test suite (in addition to the ember app)
  includeTests: boolean;

  // This will receive the parsed document. It may optionally modify the
  // document. And it must return a description of the locations where we're
  // supposed to insert the parts of the Ember app.
  prepare(dom: JSDOM): EmberHTML;
}

export type Asset = OnDiskAsset | InMemoryAsset | EmberAsset;
