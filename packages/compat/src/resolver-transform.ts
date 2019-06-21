import { default as Resolver, ComponentResolution } from './resolver';

// This is the AST transform that resolves components and helpers at build time
// and puts them into `dependencies`.
export function makeResolverTransform(resolver: Resolver) {
  function resolverTransform({ filename }: { filename: string }) {
    resolver.enter(filename);

    let scopeStack = new ScopeStack();

    return {
      name: 'embroider-build-time-resolver',

      visitor: {
        Program: {
          enter(node: any) {
            scopeStack.push(node.blockParams);
          },
          exit() {
            scopeStack.pop();
          },
        },
        BlockStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          const resolution = resolver.resolveMustache(node.path.original, hasArgs, filename);
          if (resolution && resolution.type === 'component') {
            scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
              for (let name of argumentsAreComponents) {
                let pair = node.hash.pairs.find((pair: any) => pair.key === name);
                if (pair) {
                  handleImpliedComponentHelper(node.path.original, name, pair.value, resolver, filename, scopeStack);
                }
              }
            });
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
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          resolver.resolveSubExpression(node.path.original, filename);
        },
        MustacheStatement(node: any) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, filename);
          if (resolution && resolution.type === 'component') {
            for (let name of resolution.argumentsAreComponents) {
              let pair = node.hash.pairs.find((pair: any) => pair.key === name);
              if (pair) {
                handleImpliedComponentHelper(node.path.original, name, pair.value, resolver, filename, scopeStack);
              }
            }
          }
        },
        ElementNode: {
          enter(node: any) {
            if (!scopeStack.inScope(node.tag.split('.')[0])) {
              const resolution = resolver.resolveElement(node.tag, filename);
              if (resolution && resolution.type === 'component') {
                scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
                  for (let name of argumentsAreComponents) {
                    let attr = node.attributes.find((attr: any) => attr.name === '@' + name);
                    if (attr) {
                      handleImpliedComponentHelper(node.tag, name, attr.value, resolver, filename, scopeStack);
                    }
                  }
                });
              }
            }
            scopeStack.push(node.blockParams);
          },
          exit() {
            scopeStack.pop();
          },
        },
      },
    };
  }
  resolverTransform.parallelBabel = {
    requireFile: __filename,
    buildUsing: 'makeResolverTransform',
    params: Resolver,
  };
  return resolverTransform;
}

interface ComponentBlockMarker {
  type: 'componentBlockMarker';
  resolution: ComponentResolution;
  argumentsAreComponents: string[];
  exit: (marker: ComponentBlockMarker) => void;
}

type ScopeEntry = { type: 'blockParams'; blockParams: string[] } | ComponentBlockMarker;

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
    let next = this.stack[0];
    if (next && next.type === 'componentBlockMarker') {
      next.exit(next);
      this.stack.shift();
    }
  }

  // right before we enter a block, we might determine that some of the values
  // that will be yielded as marked (by a rule) as safe to be used with the
  // {{component}} helper.
  enteringComponentBlock(resolution: ComponentResolution, exit: ComponentBlockMarker['exit']) {
    this.stack.unshift({
      type: 'componentBlockMarker',
      resolution,
      argumentsAreComponents: resolution.argumentsAreComponents.slice(),
      exit,
    });
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
      let next = this.stack[i + 1];
      if (here.type === 'blockParams' && next.type === 'componentBlockMarker') {
        let positionalIndex = here.blockParams.indexOf(parts[0]);
        if (positionalIndex === -1) {
          continue;
        }

        if (parts.length === 1) {
          if (next.resolution.yieldsComponents[positionalIndex] === true) {
            return true;
          }
          let sourceArg = next.resolution.yieldsArguments[positionalIndex];
          if (typeof sourceArg === 'string') {
            next.argumentsAreComponents.push(sourceArg);
            return true;
          }
        } else {
          let entry = next.resolution.yieldsComponents[positionalIndex];
          if (entry && typeof entry === 'object') {
            return entry[parts[1]] === true;
          }

          let argsEntry = next.resolution.yieldsArguments[positionalIndex];
          if (argsEntry && typeof argsEntry === 'object') {
            let sourceArg = argsEntry[parts[1]];
            if (typeof sourceArg === 'string') {
              next.argumentsAreComponents.push(sourceArg);
              return true;
            }
          }
        }
        // we found the source of the name, but there were no rules to cover it.
        // Don't keep searching higher, those are different names.
        return false;
      }
    }
    return false;
  }
}

function handleImpliedComponentHelper(
  componentName: string,
  argumentName: string,
  param: any,
  resolver: Resolver,
  moduleName: string,
  scopeStack: ScopeStack
) {
  if (handleComponentHelper(param, resolver, moduleName, scopeStack)) {
    return;
  }

  if (
    param.type === 'MustacheStatement' &&
    param.hash.pairs.length === 0 &&
    param.params.length === 0 &&
    handleComponentHelper(param.path, resolver, moduleName, scopeStack)
  ) {
    return;
  }

  if (
    param.type === 'MustacheStatement' &&
    param.path.type === 'PathExpression' &&
    param.path.original === 'component'
  ) {
    // safe because we will handle this inner `{{component ...}}` mustache on its own
    return;
  }

  if (param.type === 'TextNode') {
    resolver.resolveComponentHelper(param.chars, true, moduleName);
    return;
  }

  if (param.type === 'SubExpression' && param.path.type === 'PathExpression' && param.path.original === 'component') {
    // safe because we will handle this inner `(component ...)` subexpression on its own
    return;
  }

  resolver.unresolvableComponentArgument(componentName, argumentName, moduleName);
}

function handleComponentHelper(param: any, resolver: Resolver, moduleName: string, scopeStack: ScopeStack) {
  switch (param.type) {
    case 'StringLiteral':
      resolver.resolveComponentHelper(param.value, true, moduleName);
      return true;
    case 'PathExpression':
      if (!scopeStack.safeComponentInScope(param.original)) {
        resolver.resolveComponentHelper(param.original, false, moduleName);
      }
      return true;
  }
  return false;
}
