export interface Path {
  type: 'relative' | 'absolute';
  toString(): string;
}

export interface AbsolutePath extends Path {
  type: 'absolute';
}
export interface RelativePath extends Path {
  type: 'relative';
}

export interface URL {
  type: 'absolute' | 'root-relative' | 'relative';
  toString(): string;
}

export interface AbsoluteURL extends URL {
  type: 'absolute';
}
export interface RootRelativeURL extends URL {
  type: 'root-relative';
}
export interface RelativeURL extends URL {
  type: 'relative';
}
