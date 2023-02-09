import { ComponentLike } from '@glint/template';
import Helper from '@ember/component/helper';
import { getOwnConfig, getConfig, dependencySatisfies, failBuild, maybeAttrs } from '@embroider/macros';

export function ensureSafeComponent<C extends string | ComponentLike<S>, S>(
  component: C,
  thingWithOwner: unknown
): C extends string ? ComponentLike<unknown> : C;

export class EnsureSafeComponentHelper<
  C extends string | ComponentLike<S>,
  S
> extends Helper<{
  Args: {
    Positional: [component: C];
  };
  Return: C extends string ? ComponentLike<unknown> : C;
}> {}

export class macroGetConfig extends Helper<{
  Args: { Positional: Parameters<typeof getConfig>; };
  Return: ReturnType<typeof getConfig>;
}> {}

export class macroGetOwnConfig extends Helper<{
  Args: { Positional: Parameters<typeof getOwnConfig>; };
  Return: ReturnType<typeof getOwnConfig>;
}> {}

export class macroCondition extends Helper<{
  Args: { Positional: [predicate: unknown] };
  Return: ReturnType<typeof _macroCondition>;
}> {}

export class macroDependencySatisfies extends Helper<{
  Args: { Positional: Parameters<typeof dependencySatisfies>; };
  Return: ReturnType<typeof dependencySatisfies>;
}> {}

export class macroMaybeAttrs extends Helper<{
  Args: { Positional: Parameters<typeof maybeAttrs>; };
  Return: ReturnType<typeof maybeAttrs>;
}> {}

export class macroFailBuild extends Helper<{
  Args: { Positional: Parameters<typeof failBuild>; };
  Return: ReturnType<typeof failBuild>;
}> {}

export interface EmbroiderMacrosRegistry {
  'ensure-safe-component': typeof EnsureSafeComponentHelper;
  macroGetOwnConfig: typeof macroGetOwnConfig;
  macroGetConfig: typeof macroGetConfig;
  macroCondition: typeof macroCondition;
  macroDependencySatisfies: typeof macroDependencySatisfies;
  macroMaybeAttrs: typeof macroMaybeAttrs;
  macroFailBuild: typeof macroFailBuild;
}
