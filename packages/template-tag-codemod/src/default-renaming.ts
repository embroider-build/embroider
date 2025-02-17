import { htmlTagNames } from 'html-tag-names';

export default function defaultRenaming(
  name: string,
  kind: 'component' | 'helper' | 'modifier' | 'ambiguous-component-or-helper'
): string | null {
  // Strip off @ namespacing
  let parts = name.split('@');
  if (parts.length > 1) {
    name = capitalize(parts[parts.length - 1]);
  }

  // Strip off :: namespacing
  parts = name.split('::');
  if (parts.length > 1) {
    name = parts[parts.length - 1];
  }

  if (htmlTagNames.includes(name)) {
    name = name + '_';
  }

  if (kind === 'component') {
    name = capitalize(name);
  }

  return name;
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
