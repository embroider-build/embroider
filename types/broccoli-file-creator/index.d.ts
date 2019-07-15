declare module 'broccoli-file-creator' {
  import { Tree } from 'broccoli-plugin';
  export default function writeFile(
    filename: string,
    content: string | Promise<string> | (() => string) | (() => Promise<string>)
  ): Tree;
}
