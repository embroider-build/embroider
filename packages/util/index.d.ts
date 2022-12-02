import { ComponentLike } from '@glint/template';

export function ensureSafeComponent<C extends string | ComponentLike<S>, S>(
  component: C,
  thingWithOwner: unknown
): C extends string ? ComponentLike<unknown> : C;
