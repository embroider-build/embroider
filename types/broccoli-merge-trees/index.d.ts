declare module 'broccoli-merge-trees' {
  import { Tree } from 'broccoli-plugin';
  export interface Options {
    overwrite?: boolean;
    annotation?: string;
  }
  export default function(trees: Tree[], options?: Options): Tree;
}
