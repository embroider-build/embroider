/* global Ember */
const { isCurriedComponentDefinition, CurriedComponentDefinition } = Ember.__loader.require('@glimmer/runtime');

export { isCurriedComponentDefinition };

export function lookupCurriedComponentDefinition(name, owner) {
  let resolver = owner.lookup('renderer:-dom')._runtimeResolver;
  let handle = resolver.lookupComponentHandle(name, { owner });
  if (handle != null) {
    return new CurriedComponentDefinition(resolver.resolve(handle), null);
  }
}
