import { default as Resolver, ComponentResolution, ComponentLocator } from './resolver';
import type { ASTv1 } from '@glimmer/syntax';

// This is the AST transform that resolves components, helpers and modifiers at build time
// and puts them into `dependencies`.
export function makeResolverTransform(resolver: Resolver) {
  function resolverTransform({ filename, contents }: { filename: string; contents: string }) {
    resolver.enter(filename, contents);

    let scopeStack = new ScopeStack();

    return {
      name: 'embroider-build-time-resolver',

      visitor: {
        Program: {
          enter(node: ASTv1.Program) {
            scopeStack.push(node.blockParams);
          },
          exit() {
            scopeStack.pop();
          },
        },
        BlockStatement(node: ASTv1.BlockStatement) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.this === true) {
            return;
          }
          if (node.path.parts.length > 1) {
            // paths with a dot in them (which therefore split into more than
            // one "part") are classically understood by ember to be contextual
            // components, which means there's nothing to resolve at this
            // location.
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          const resolution = resolver.resolveMustache(node.path.original, hasArgs, filename, node.path.loc);
          if (resolution && resolution.type === 'component') {
            scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
              for (let name of argumentsAreComponents) {
                let pair = node.hash.pairs.find((pair: ASTv1.HashPair) => pair.key === name);
                if (pair) {
                  handleComponentHelper(pair.value, resolver, filename, scopeStack, {
                    componentName: (node.path as ASTv1.PathExpression).original,
                    argumentName: name,
                  });
                }
              }
            });
          }
        },
        SubExpression(node: ASTv1.SubExpression) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (node.path.this === true) {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          if (node.path.original === 'helper' && node.params.length > 0) {
            handleDynamicHelper(node.params[0], resolver, filename);
            return;
          }
          if (node.path.original === 'modifier' && node.params.length > 0) {
            handleDynamicModifier(node.params[0], resolver, filename);
            return;
          }
          resolver.resolveSubExpression(node.path.original, filename, node.path.loc);
        },
        MustacheStatement(node: ASTv1.MustacheStatement) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.this === true) {
            return;
          }
          if (node.path.parts.length > 1) {
            // paths with a dot in them (which therefore split into more than
            // one "part") are classically understood by ember to be contextual
            // components, which means there's nothing to resolve at this
            // location.
            return;
          }
          if (node.path.original === 'component' && node.params.length > 0) {
            handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            return;
          }
          if (node.path.original === 'helper' && node.params.length > 0) {
            handleDynamicHelper(node.params[0], resolver, filename);
            return;
          }
          let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, filename, node.path.loc);
          if (resolution && resolution.type === 'component') {
            for (let name of resolution.argumentsAreComponents) {
              let pair = node.hash.pairs.find((pair: ASTv1.HashPair) => pair.key === name);
              if (pair) {
                handleComponentHelper(pair.value, resolver, filename, scopeStack, {
                  componentName: node.path.original,
                  argumentName: name,
                });
              }
            }
          }
        },
        ElementModifierStatement(node: ASTv1.ElementModifierStatement) {
          if (node.path.type !== 'PathExpression') {
            return;
          }
          if (scopeStack.inScope(node.path.parts[0])) {
            return;
          }
          if (node.path.this === true) {
            return;
          }
          if (node.path.data === true) {
            return;
          }
          if (node.path.parts.length > 1) {
            // paths with a dot in them (which therefore split into more than
            // one "part") are classically understood by ember to be contextual
            // components. With the introduction of `Template strict mode` in Ember 3.25
            // it is also possible to pass modifiers this way which means there's nothing
            // to resolve at this location.
            return;
          }

          resolver.resolveElementModifierStatement(node.path.original, filename, node.path.loc);
        },
        ElementNode: {
          enter(node: ASTv1.ElementNode) {
            if (!scopeStack.inScope(node.tag.split('.')[0])) {
              const resolution = resolver.resolveElement(node.tag, filename, node.loc);
              if (resolution && resolution.type === 'component') {
                scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
                  for (let name of argumentsAreComponents) {
                    let attr = node.attributes.find((attr: ASTv1.AttrNode) => attr.name === '@' + name);
                    if (attr) {
                      handleComponentHelper(attr.value, resolver, filename, scopeStack, {
                        componentName: node.tag,
                        argumentName: name,
                      });
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

function handleComponentHelper(
  param: ASTv1.Node,
  resolver: Resolver,
  moduleName: string,
  scopeStack: ScopeStack,
  impliedBecause?: { componentName: string; argumentName: string }
): void {
  let locator: ComponentLocator;
  switch (param.type) {
    case 'StringLiteral':
      locator = { type: 'literal', path: param.value };
      break;
    case 'PathExpression':
      locator = { type: 'path', path: param.original };
      break;
    case 'MustacheStatement':
      if (param.hash.pairs.length === 0 && param.params.length === 0) {
        handleComponentHelper(param.path, resolver, moduleName, scopeStack, impliedBecause);
        return;
      } else if (param.path.type === 'PathExpression' && param.path.original === 'component') {
        // safe because we will handle this inner `{{component ...}}` mustache on its own
        return;
      } else {
        locator = { type: 'other' };
      }
      break;
    case 'TextNode':
      locator = { type: 'literal', path: param.chars };
      break;
    case 'SubExpression':
      if (param.path.type === 'PathExpression' && param.path.original === 'component') {
        // safe because we will handle this inner `(component ...)` subexpression on its own
        return;
      }
      if (param.path.type === 'PathExpression' && param.path.original === 'ensure-safe-component') {
        // safe because we trust ensure-safe-component
        return;
      }
      locator = { type: 'other' };
      break;
    default:
      locator = { type: 'other' };
  }

  if (locator.type === 'path' && scopeStack.safeComponentInScope(locator.path)) {
    return;
  }

  resolver.resolveComponentHelper(locator, moduleName, param.loc, impliedBecause);
}

function handleDynamicHelper(param: ASTv1.Expression, resolver: Resolver, moduleName: string): void {
  // We only need to handle StringLiterals since Ember already throws an error if unsupported values
  // are passed to the helper keyword.
  // If a helper reference is passed in we don't need to do anything since it's either the result of a previous
  // helper keyword invocation, or a helper reference that was imported somewhere.
  if (param.type === 'StringLiteral') {
    resolver.resolveDynamicHelper({ type: 'literal', path: param.value }, moduleName, param.loc);
  }
}

function handleDynamicModifier(param: ASTv1.Expression, resolver: Resolver, moduleName: string): void {
  if (param.type === 'StringLiteral') {
    resolver.resolveDynamicModifier({ type: 'literal', path: param.value }, moduleName, param.loc);
  }
}
