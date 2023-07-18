import Component from '@glimmer/component';
import Fancy from './fancy';

export default class extends Component {
  message = 'hi';
  Fancy = Fancy;
}
