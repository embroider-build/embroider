// eslint-disable-next-line ember/no-classic-components
import Component, { setComponentTemplate } from '@ember/component';
import template from 'dummy/templates/components/legacy-with-template';

class LegacyWithTemplateComponent extends Component {
  tagName = '';
}

export default setComponentTemplate(template, LegacyWithTemplateComponent);
