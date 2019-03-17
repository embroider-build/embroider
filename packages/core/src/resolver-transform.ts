import { Resolver, Resolution } from './resolver';

// This is the AST transform that resolves components and helpers at build time
// and puts them into `dependencies`.
export function makeResolverTransform(resolver: Resolver, dependencies: Map<string, Resolution[]>) {
  return function resolverTransform(env: { moduleName: string }) {
    let deps: Resolution[] = [];
    dependencies.set(env.moduleName, deps);

    let scopeStack: string[][] = [];

    return {
      name: 'embroider-build-time-resolver',

      visitor: {
        Program: {
          enter(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.push(node.blockParams);
            }
          },
          exit(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.pop();
            }
          }
        },
        BlockStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          let resolution = resolver.resolveSubExpression(node.path.original, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (inScope(scopeStack, node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, deps);
          }
          let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
          if (resolution) {
            deps.push(resolution);
          }
        },
        ElementNode: {
          enter(node: any) {
            if (!inScope(scopeStack, node.tag.split('.')[0])) {
              let resolution = resolver.resolveElement(node.tag, env.moduleName);
              if (resolution) {
                deps.push(resolution);
              }
            }
            if (node.blockParams.length > 0) {
              scopeStack.push(node.blockParams);
            }
          },
          exit(node: any) {
            if (node.blockParams.length > 0) {
              scopeStack.pop();
            }
          }
        }
      }
    };
  };
}

function inScope(scopeStack: string[][], name: string) {
  for (let scope of scopeStack) {
    if (scope.includes(name)) {
      return true;
    }
  }
  return false;
}

function handleComponentHelper(param: any, resolver: Resolver, moduleName: string, deps: Resolution[]) {
  let resolution;
  if (param.type === 'StringLiteral') {
    resolution = resolver.resolveComponentHelper(param.value, true, moduleName);
  } else {
    resolution = resolver.resolveComponentHelper(param.original, false, moduleName);
  }
  if (resolution) {
    deps.push(resolution);
  }
}
