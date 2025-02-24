import { type NodePath } from '@babel/core';

export function isLooseHBS(path: NodePath<unknown>): false | { supportsScope: boolean } {
  let callee: NodePath<unknown> | undefined;
  if (path.isTaggedTemplateExpression()) {
    callee = path.get('tag');
  } else if (path.isCallExpression()) {
    callee = path.get('callee');
  }

  if (!callee?.isReferencedIdentifier()) {
    return false;
  }

  if (callee.referencesImport('ember-cli-htmlbars', 'hbs')) {
    return { supportsScope: false };
  }

  if (callee.referencesImport('ember-cli-htmlbars-inline-precompile', 'default')) {
    return { supportsScope: false };
  }

  if (callee.referencesImport('htmlbars-inline-precompile', 'default')) {
    return { supportsScope: false };
  }

  if (callee.referencesImport('@ember/template-compilation', 'precompileTemplate')) {
    return { supportsScope: true };
  }

  return false;
}

export function allLegacyModules() {
  return [
    'ember-cli-htmlbars' as const,
    'ember-cli-htmlbars-inline-precompile' as const,
    'htmlbars-inline-precompile' as const,
  ];
}

export function allHBSModules() {
  return ['@ember/template-compilation', ...allLegacyModules()];
}
