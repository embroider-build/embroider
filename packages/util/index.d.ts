import { ComponentLike } from '@glint/template';
import TemplateRegistry from '@glint/environment-ember-loose/registry';
import Helper from '@ember/component/helper';

export function ensureSafeComponent<C extends string | ComponentLike<any>>(
  component: C,
  thingWithOwner: unknown
): C extends keyof TemplateRegistry
  ? TemplateRegistry[C]
  : C extends string
  ? ComponentLike<unknown>
  : C;

export class EnsureSafeComponentHelper<
  C extends string | ComponentLike<any>
> extends Helper<{
  Args: {
    Positional: [component: C];
  };
  Return: C extends keyof TemplateRegistry
    ? TemplateRegistry[C]
    : C extends string
    ? ComponentLike<unknown>
    : C;
}> {}

export interface EmbroiderUtilRegistry {
  'ensure-safe-component': typeof EnsureSafeComponentHelper;
}
