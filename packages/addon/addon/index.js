import { deprecate } from '@ember/debug';

export function ensureSafeComponent(value) {
  if (typeof value === 'string') {
    return handleString(value);
  } else {
    return value;
  }
}

function handleString(name) {
  deprecate(
    `You're trying to invoke the component "${name}" by passing its name as a string. This won't work under Embroider.`,
    false,
    {
      id: 'ensure-safe-component.string',
      url: 'https://example.com/TODO',
      until: 'embroider',
      for: '@embroider/addon',
    }
  );

  // TODO: this will fail on latest beta because the bug was fixed
  return name;
}
