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

export type Asset = OnDiskAsset | InMemoryAsset;
