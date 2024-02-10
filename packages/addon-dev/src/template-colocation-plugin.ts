import { type Options as TemplateColocationPluginOptions } from '@embroider/core';

export { TemplateColocationPluginOptions as Options };

// NOTE: @embroider/core is compiled to CJS, so its own `export * from shared-internals`
// doesn't work how we want (which is what would provide packageName
import eCore from '@embroider/core';

export const templateColocationPlugin = eCore.templateColocationPlugin;
export default templateColocationPlugin;
