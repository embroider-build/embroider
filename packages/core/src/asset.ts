import type { JSDOM } from 'jsdom';
import type { EmberHTML } from './ember-html';

interface BaseAsset {
  // where this asset should be placed, relative to the app's root
  relativePath: string;
}

export interface OnDiskAsset extends BaseAsset {
  kind: 'on-disk';

  // absolute path to where we will find it
  sourcePath: string;
  mtime: number;
  size: number;
}

export interface InMemoryAsset extends BaseAsset {
  kind: 'in-memory';

  // the actual bits
  source: string | Buffer;
}

// This represents an HTML entrypoint to the Ember app
export interface EmberAsset extends BaseAsset {
  kind: 'ember';

  // absolute path to where we will find the html file
  sourcePath: string;

  // these describe the file at sourcePath so we can avoid rebuilding when it
  // hasn't changed
  mtime: number;
  size: number;

  // whether we should include the test suite (in addition to the ember app)
  includeTests: boolean;

  // the rootURL at which this Ember app expects to be hosted.
  rootURL: string;

  // This will receive the parsed document. It may optionally modify the
  // document. And it must return a description of the locations where we're
  // supposed to insert the parts of the Ember app.
  prepare(dom: JSDOM): EmberHTML;
}

export type Asset = OnDiskAsset | InMemoryAsset | EmberAsset;
