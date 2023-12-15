import Component from '@glimmer/component';
import Fancy from './fancy';

export default class Example extends Component {
  message = 'hi';
  Fancy = Fancy;
}
