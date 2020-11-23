declare module 'broccoli-merge-trees' {
  import { Node } from 'broccoli-node-api';
  export interface Options {
    overwrite?: boolean;
    annotation?: string;
  }
  export default function (trees: Node[], options?: Options): Node;
}
