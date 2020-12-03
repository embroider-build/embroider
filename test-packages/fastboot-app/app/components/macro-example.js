import Component from '@glimmer/component';
import { macroCondition, getGlobalConfig } from '@embroider/macros';

export default class MacroExampleComponent extends Component {
  get myEnvironment() {
    if (macroCondition(getGlobalConfig().fastboot?.isRunning)) {
      return 'macro-example: I am in fastboot';
    } else {
      return 'macro-example: I am in browser';
    }
  }
}
