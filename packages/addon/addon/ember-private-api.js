/* global Ember */
const { isCurriedComponentDefinition, CurriedComponentDefinition } = Ember.__loader.require('@glimmer/runtime');

export { isCurriedComponentDefinition };

function runtimeResolver(owner) {
  let resolver = owner.lookup('renderer:-dom')._runtimeResolver;
  if (resolver) {
    return resolver;
  }

  let entry = Object.entries(owner.__container__.cache).find(e => e[0].startsWith('template-compiler:main-'));
  if (entry) {
    return entry[1].resolver.resolver;
  }

  throw new Error(`@embroider/addon couldn't locate the runtime resolver on this ember version`);
}

export function lookupCurriedComponentDefinition(name, owner) {
  let resolver = runtimeResolver(owner);
  let handle = resolver.lookupComponentHandle(name, { owner });
  if (handle != null) {
    return new CurriedComponentDefinition(resolver.resolve(handle), null);
  }
}
