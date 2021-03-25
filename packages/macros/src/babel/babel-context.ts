// This type probably exists somewhere in our dependencies but I couldn't find
// it. It's the object babel passes to your plugin function.
import type { types, template } from '@babel/core';
export interface BabelContext {
  template: typeof template;
  types: typeof types;
}
