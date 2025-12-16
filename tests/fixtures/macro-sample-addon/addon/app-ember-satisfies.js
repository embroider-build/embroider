import { appEmberSatisfies } from '@embroider/macros';

export default function() {
  return {
    aboveTwo: appEmberSatisfies('> 2.0.0'),
    belowTwo: appEmberSatisfies('< 2.0.0')
  };
}
