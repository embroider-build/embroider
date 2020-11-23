declare module 'broccoli-file-creator' {
  import { Node } from 'broccoli-node-api';
  export default function writeFile(
    filename: string,
    content: string | Promise<string> | (() => string) | (() => Promise<string>)
  ): Node;
}
