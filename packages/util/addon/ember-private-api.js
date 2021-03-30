import {
  macroCondition,
  dependencySatisfies,
  importSync,
} from '@embroider/macros';

let runtime;

if (
  macroCondition(
    dependencySatisfies('ember-source', '>=3.27.0-canary || >=3.27.0-beta')
  )
) {
  // new enough ember has a real module we can import
  runtime = importSync('@glimmer/runtime');
} else {
  // older ember has its own internal loader
  runtime = window.Ember.__loader.require('@glimmer/runtime');
}

let {
  isCurriedComponentDefinition,
  CurriedComponentDefinition,
  curry,
  CurriedValue,
} = runtime;

// older embers have isCurriedComponentDefinition, new ones have CurriedValue
// and instanceof CurriedValue seems good enough.
if (!isCurriedComponentDefinition) {
  isCurriedComponentDefinition = function (value) {
    return value instanceof CurriedValue;
  };
}

export { isCurriedComponentDefinition };

function runtimeResolver(owner) {
  let resolver = owner.lookup('renderer:-dom')._runtimeResolver;
  if (resolver) {
    return resolver;
  }

  let entry = Object.entries(owner.__container__.cache).find((e) =>
    e[0].startsWith('template-compiler:main-')
  );
  if (entry) {
    return entry[1].resolver.resolver;
  }

  throw new Error(
    `@embroider/util couldn't locate the runtime resolver on this ember version`
  );
}

export function lookupCurriedComponentDefinition(name, owner) {
  let resolver = runtimeResolver(owner);
  if (typeof resolver.lookupComponentHandle === 'function') {
    let handle = resolver.lookupComponentHandle(name, contextForLookup(owner));
    if (handle != null) {
      return new CurriedComponentDefinition(resolver.resolve(handle), null);
    }
  }

  // here we're doing the same thing the internal currying does, in order to
  // generate a sane error message (even though we don't actually use
  // resolvedDefinition as part of our return value).
  let resolvedDefinition = resolver.lookupComponent(name, owner);
  if (!resolvedDefinition) {
    throw new Error(
      `Attempted to resolve \`${name}\` via ensureSafeComponent, but nothing was found.`
    );
  }
  return curry(0, name, owner, { named: {}, positional: [] });
}

function contextForLookup(owner) {
  if (
    macroCondition(
      dependencySatisfies('ember-source', '>=3.24.0-canary || >=3.24.0-beta')
    )
  ) {
    return owner;
  } else {
    return { owner };
  }
}
