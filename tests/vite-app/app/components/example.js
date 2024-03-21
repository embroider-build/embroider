import Component from '@glimmer/component';
import Fancy from './fancy.gts';

export default class extends Component {
  message = 'hi';
  Fancy = Fancy;
}
