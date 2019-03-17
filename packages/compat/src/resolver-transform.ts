import { default as Resolver } from './resolver';
import { ComponentRules } from './dependency-rules';

// This is the AST transform that resolves components and helpers at build time
// and puts them into `dependencies`.
export function makeResolverTransform(resolver: Resolver) {
  return function resolverTransform(env: { moduleName: string }) {
    resolver.enter(env.moduleName);

    let scopeStack = new ScopeStack();

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
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, scopeStack);
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
          if (resolution) {
            if (resolution.type === 'component' && node.program.blockParams.length > 0 && resolution.yieldsComponents.length > 0) {
              scopeStack.yieldingComponents(resolution.yieldsComponents);
            }
          }
        },
        SubExpression(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, scopeStack);
          }
          resolver.resolveSubExpression(node.path.original, env.moduleName);
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            return handleComponentHelper(node.params[0], resolver, env.moduleName, scopeStack);
          }
          let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
          resolver.resolveMustache(node.path.original, hasArgs, env.moduleName);
        },
        ElementNode: {
          enter(node: any) {
            if (!scopeStack.inScope(node.tag.split('.')[0])) {
              resolver.resolveElement(node.tag, env.moduleName);
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

type ScopeEntry =
{ type: 'blockParams', blockParams: string[] } |
{ type: 'safeComponentMarker', safeComponentMarker: Required<ComponentRules>["yieldsSafeComponents"] };

class ScopeStack {
  private stack: ScopeEntry[] = [];

  // as we enter a block, we push the block params onto here to mark them as
  // being in scope
  push(blockParams: string[]) {
    this.stack.unshift({ type: 'blockParams', blockParams });
  }

  // and when we leave the block they go out of scope. If this block was tagged
  // by a safe component marker, we also clear that.
  pop() {
    this.stack.shift();
    if (this.stack.length > 0 && this.stack[0]!.type === 'safeComponentMarker') {
      this.stack.shift();
    }
  }

  // right before we enter a block, we might determine that some of the values
  // that will be yielded as marked (by a rule) as safe to be used with the
  // {{component}} helper.
  yieldingComponents(safeComponentMarker: Required<ComponentRules>["yieldsSafeComponents"]) {
    this.stack.unshift({ type: 'safeComponentMarker', safeComponentMarker});
  }

  inScope(name: string) {
    for (let scope of this.stack) {
      if (scope.type === 'blockParams' && scope.blockParams.includes(name)) {
        return true;
      }
    }
    return false;
  }

  safeComponentInScope(name: string): boolean {
    let parts = name.split('.');
    if (parts.length > 2) {
      // we let component rules specify that they yield components or objects
      // containing components. But not deeper than that. So the max path length
      // that can refer to a marked-safe component is two segments.
      return false;
    }
    for (let i = 0; i < this.stack.length - 1; i++) {
      let here = this.stack[i];
      let next = this.stack[i+1];
      if (here.type === 'blockParams' && next.type === 'safeComponentMarker') {
        let positionalIndex = here.blockParams.indexOf(parts[0]);
        if (positionalIndex === -1) {
          continue;
        }
        if (parts.length === 1) {
          return next.safeComponentMarker[positionalIndex] === true;
        } else {
          let entry = next.safeComponentMarker[positionalIndex];
          if (entry && typeof entry === 'object') {
            return entry[parts[1]] === true;
          }
        }
      }
    }
    return false;
  }
}

function handleComponentHelper(param: any, resolver: Resolver, moduleName: string, scopeStack: ScopeStack) {
  if (param.type === 'StringLiteral') {
    resolver.resolveComponentHelper(param.value, true, moduleName);
  } else {
    if (!scopeStack.safeComponentInScope(param.original)) {
      resolver.resolveComponentHelper(param.original, false, moduleName);
    }
  }
}
