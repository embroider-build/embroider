import Helper from '@ember/component/helper';
import { dependencySatisfies, failBuild, getConfig, getOwnConfig, maybeAttrs } from './index';
import { EnsureSafeComponentHelper } from '@embroider/util';

export class MacroGetConfigHelper extends Helper<{
  Args: { Positional: [packageName: string, ...keys: string[]] };
  Return: ReturnType<typeof getConfig>;
}> {}

export class MacroGetOwnConfigHelper extends Helper<{
  Args: { Positional: [...keys: string[]] };
  Return: ReturnType<typeof getOwnConfig>;
}> {}

export class MacroConditionHelper extends Helper<{
  Args: { Positional: [predicate: unknown] };
  Return: boolean;
}> {}

export class MacroDependencySatisfiesHelper extends Helper<{
  Args: { Positional: Parameters<typeof dependencySatisfies> };
  Return: ReturnType<typeof dependencySatisfies>;
}> {}

export class MacroMaybeAttrsHelper extends Helper<{
  Args: { Positional: Parameters<typeof maybeAttrs> };
  Return: ReturnType<typeof maybeAttrs>;
}> {}

export class MacroFailBuildHelper extends Helper<{
  Args: { Positional: Parameters<typeof failBuild> };
  Return: ReturnType<typeof failBuild>;
}> {}

export interface EmbroiderMacrosRegistry {
  'ensure-safe-component': typeof EnsureSafeComponentHelper;
  macroGetOwnConfig: typeof MacroGetOwnConfigHelper;
  macroGetConfig: typeof MacroGetConfigHelper;
  macroCondition: typeof MacroConditionHelper;
  macroDependencySatisfies: typeof MacroDependencySatisfiesHelper;
  macroMaybeAttrs: typeof MacroMaybeAttrsHelper;
  macroFailBuild: typeof MacroFailBuildHelper;
}
