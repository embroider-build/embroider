import { assert, deprecate } from '@ember/debug';
import { getOwner } from '@ember/application';
import {
  isCurriedComponentDefinition,
  lookupCurriedComponentDefinition,
} from './ember-private-api';
import Helper from '@ember/component/helper';
import { getComponentTemplate } from '@ember/component';

export function ensureSafeComponent(value, thingWithOwner) {
  if (typeof value === 'string') {
    return handleString(value, thingWithOwner);
  } else if (isCurriedComponentDefinition(value)) {
    return value;
  } else if (value == null) {
    return value;
  } else {
    return handleClass(value, thingWithOwner);
  }
}

export class EnsureSafeComponentHelper extends Helper {
  compute([value]) {
    return ensureSafeComponent(value, this);
  }
}

function handleString(name, thingWithOwner) {
  deprecate(
    `You're trying to invoke the component "${name}" by passing its name as a string. This won't work under Embroider.`,
    false,
    {
      id: 'ensure-safe-component.string',
      url: 'https://github.com/embroider-build/embroider/blob/master/ADDON-AUTHOR-GUIDE.md#when-youre-passing-a-component-to-someone-else',
      until: 'embroider',
      for: '@embroider/util',
      since: '0.27.0',
    }
  );

  let owner = getOwner(thingWithOwner);
  return lookupCurriedComponentDefinition(name, owner);
}

function ensureRegistered(klass, owner) {
  let service = owner.lookup('service:-ensure-registered');
  assert('Could not lookup private -ensure-registered service', service);

  return service.register(klass, owner);
}

function handleClass(klass, thingWithOwner) {
  assert(
    `ensureSafeComponent cannot work with legacy components without associated templates. Received class "${klass.name}". Consider migrating to co-located templates!`,
    getComponentTemplate(klass)
  );

  let owner = getOwner(thingWithOwner);
  let nonce = ensureRegistered(klass, owner);
  return lookupCurriedComponentDefinition(nonce, owner);
}
