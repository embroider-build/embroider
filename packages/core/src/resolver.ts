import Options from './options';
import { ModuleRules } from './dependency-rules';

type ResolutionResult = {
  type: "component";
  modules: ({runtimeName: string, path: string})[];
  yieldsComponents: ModuleRules["yieldsSafeComponents"];
  argumentsAreComponents: string[];
} | {
  type: "helper";
  modules: ({runtimeName: string, path: string})[];
};

interface ResolutionFail {
  type: "error";
  hardFail: boolean;
  message: string;
}

export type Resolution = ResolutionResult | ResolutionFail;

// In all these methods, a null result means you can't resolve anything but it's
// not an error because there is a fallback to other behavior. For example:
//
//  resolveElement('div', ...)
//
// would return null because there's no such component, but that's OK.
// Similarly,
//
//  resolveMustache('foo', ...)
//
// may return null if there's really no such helper or component, in which case
// it becomes the classic "this.foo".
//
// On the other hand, when you know a thing is bad you should use one of the
// ResolutionFail cases.
//
export interface ResolverInstance {
  resolveSubExpression(path: string, from: string): Resolution | null;
  resolveMustache(path: string, hasArgs: boolean, from: string): Resolution | null;
  resolveElement(tagName: string, from: string): Resolution | null;
  resolveComponentHelper(path: string, isLiteral: boolean, from: string): Resolution | null;
}

export interface ResolverParams {
  root: string;
  modulePrefix: string;
  options: Required<Options>;
}

export interface Resolver {
  new (params: ResolverParams): ResolverInstance;
}
