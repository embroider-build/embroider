import { Tree } from 'broccoli-plugin';

export default interface V1Package {
  v2Trees() : Tree[];
  root: string;
}
