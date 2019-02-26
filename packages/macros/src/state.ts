import { NodePath } from '@babel/traverse';

export default interface State {
  removed: NodePath[];
}
