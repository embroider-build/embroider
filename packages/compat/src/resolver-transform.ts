import { default as Resolver, ComponentResolution, ComponentLocator, ResolutionFail, Resolution } from './resolver';
import type { ASTv1, ASTPluginBuilder, ASTPluginEnvironment, WalkerPath } from '@glimmer/syntax';
import type { WithJSUtils } from 'babel-plugin-ember-template-compilation';
import assertNever from 'assert-never';

type Env = WithJSUtils<ASTPluginEnvironment> & { filename: string; contents: string };

// This is the AST transform that resolves components, helpers and modifiers at build time
export default function makeResolverTransform(resolver: Resolver) {
  const resolverTransform: ASTPluginBuilder<Env> = ({
    filename,
    contents,
    meta: { jsutils },
    syntax: { builders },
  }) => {
    let scopeStack = new ScopeStack();
    let emittedAMDDeps: Set<string> = new Set();
    let errors: ResolutionFail[] = [];

    function emitAMD(resolution: ComponentResolution) {
      for (let m of [resolution.hbsModule, resolution.jsModule]) {
        if (m && !emittedAMDDeps.has(m.runtimeName)) {
          let parts = m.runtimeName.split('/');
          let { path, runtimeName } = m;
          jsutils.emitExpression(context => {
            let identifier = context.import(path, 'default', parts[parts.length - 1]);
            return `window.define("${runtimeName}", () => ${identifier})`;
          });
          emittedAMDDeps.add(m.runtimeName);
        }
      }
    }

    function emit<Target extends WalkerPath<ASTv1.Node>>(
      parentPath: Target,
      resolution: Resolution | null,
      setter: (target: Target['node'], newIdentifier: ASTv1.PathExpression) => void
    ) {
      switch (resolution?.type) {
        case 'error':
          errors.push(resolution);
          return;
        case 'helper':
        case 'modifier':
          setter(
            parentPath.node,
            builders.path(
              jsutils.bindImport(resolution.module.path, 'default', parentPath, { nameHint: resolution.nameHint })
            )
          );
          return;
        case 'component':
          // When people are using octane-style template co-location or
          // polaris-style first-class templates, we see only JS files for their
          // components, because the template association is handled before
          // we're doing any resolving here. In that case, we can safely do
          // component invocation via lexical scope.
          //
          // But when people are using the older non-co-located template style,
          // we can't safely do that -- ember needs to discover both the
          // component and the template in the AMD loader to associate them. In
          // that case, we emit just-in-time AMD definitions for them.
          if (resolution.jsModule && !resolution.hbsModule) {
            setter(
              parentPath.node,
              builders.path(
                jsutils.bindImport(resolution.jsModule.path, 'default', parentPath, { nameHint: resolution.nameHint })
              )
            );
          } else {
            emitAMD(resolution);
          }
        case undefined:
          return;
        default:
          assertNever(resolution);
      }
    }

    return {
      name: 'embroider-build-time-resolver',

      visitor: {
        Program: {
          enter(node) {
            scopeStack.push(node.blockParams);
          },
          exit() {
            scopeStack.pop();
            if (errors.length > 0) {
              throw new Error(`todo error reporting ${errors} ${contents}`);
            }
          },
        },
        BlockStatement(node, path) {
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
            let resolution = handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            emit(path, resolution, (node, newIdentifier) => {
              node.params[0] = newIdentifier;
            });
            return;
          }
          // a block counts as args from our perpsective (it's enough to prove
          // this thing must be a component, not content)
          let hasArgs = true;
          let resolution = resolver.resolveMustache(node.path.original, hasArgs, filename, node.path.loc);
          emit(path, resolution, (node, newId) => {
            node.path = newId;
          });
          if (resolution?.type === 'component') {
            scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
              let pairs = extendPath(extendPath(path, 'hash'), 'pairs');
              for (let name of argumentsAreComponents) {
                let pair = pairs.find(pair => pair.node.key === name);
                if (pair) {
                  let resolution = handleComponentHelper(pair.node.value, resolver, filename, scopeStack, {
                    componentName: (node.path as ASTv1.PathExpression).original,
                    argumentName: name,
                  });
                  emit(pair, resolution, (node, newId) => {
                    node.value = newId;
                  });
                }
              }
            });
          }
        },
        SubExpression(node, path) {
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
            let resolution = handleComponentHelper(node.params[0], resolver, filename, scopeStack);
            emit(path, resolution, (node, newId) => {
              node.params[0] = newId;
            });
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
          let resolution = resolver.resolveSubExpression(node.path.original, filename, node.path.loc);
          if (resolution?.type === 'error') {
            errors.push(resolution);
          } else if (resolution) {
            node.path = builders.path(
              jsutils.bindImport(resolution.module.path, 'default', path, {
                nameHint: node.path.original,
              })
            );
          }
        },
        MustacheStatement: {
          enter(node, path) {
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
              let resolution = handleComponentHelper(node.params[0], resolver, filename, scopeStack);
              emit(path, resolution, (node, newId) => {
                node.params[0] = newId;
              });
              return;
            }
            if (node.path.original === 'helper' && node.params.length > 0) {
              handleDynamicHelper(node.params[0], resolver, filename);
              return;
            }
            let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
            let resolution = resolver.resolveMustache(node.path.original, hasArgs, filename, node.path.loc);
            emit(path, resolution, (node, newIdentifier) => {
              node.path = newIdentifier;
            });
            if (resolution?.type === 'component') {
              let pairs = extendPath(extendPath(path, 'hash'), 'pairs');
              for (let name of resolution.argumentsAreComponents) {
                let pair = pairs.find(pair => pair.node.key === name);
                if (pair) {
                  let resolution = handleComponentHelper(pair.node.value, resolver, filename, scopeStack, {
                    componentName: node.path.original,
                    argumentName: name,
                  });
                  emit(pair, resolution, (node, newId) => {
                    node.value = newId;
                  });
                }
              }
            }
          },
        },
        ElementModifierStatement(node, path) {
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

          let resolution = resolver.resolveElementModifierStatement(node.path.original, filename, node.path.loc);
          emit(path, resolution, (node, newId) => {
            node.path = newId;
          });
        },
        ElementNode: {
          enter(node, path) {
            if (!scopeStack.inScope(node.tag.split('.')[0])) {
              const resolution = resolver.resolveElement(node.tag, filename, node.loc);
              emit(path, resolution, (node, newId) => {
                node.tag = newId.original;
              });
              if (resolution?.type === 'component') {
                scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
                  let attributes = extendPath(path, 'attributes');
                  for (let name of argumentsAreComponents) {
                    let attr = attributes.find(attr => attr.node.name === '@' + name);
                    if (attr) {
                      let resolution = handleComponentHelper(attr.node.value, resolver, filename, scopeStack, {
                        componentName: node.tag,
                        argumentName: name,
                      });
                      emit(attr, resolution, (node, newId) => {
                        node.value = builders.mustache(newId);
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
  };
  (resolverTransform as any).parallelBabel = {
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
): ComponentResolution | ResolutionFail | null {
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
        return handleComponentHelper(param.path, resolver, moduleName, scopeStack, impliedBecause);
      } else if (param.path.type === 'PathExpression' && param.path.original === 'component') {
        // safe because we will handle this inner `{{component ...}}` mustache on its own
        return null;
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
        return null;
      }
      if (param.path.type === 'PathExpression' && param.path.original === 'ensure-safe-component') {
        // safe because we trust ensure-safe-component
        return null;
      }
      locator = { type: 'other' };
      break;
    default:
      locator = { type: 'other' };
  }

  if (locator.type === 'path' && scopeStack.safeComponentInScope(locator.path)) {
    return null;
  }

  return resolver.resolveComponentHelper(locator, moduleName, param.loc, impliedBecause);
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

function extendPath<N extends ASTv1.Node, K extends keyof N>(
  path: WalkerPath<N>,
  key: K
): N[K] extends ASTv1.Node ? WalkerPath<N[K]> : N[K] extends ASTv1.Node[] ? WalkerPath<N[K][0]>[] : never {
  const _WalkerPath = path.constructor as {
    new <Child extends ASTv1.Node>(
      node: Child,
      parent?: WalkerPath<ASTv1.Node> | null,
      parentKey?: string | null
    ): WalkerPath<Child>;
  };
  let child = path.node[key];
  if (Array.isArray(child)) {
    return child.map(c => new _WalkerPath(c, path, key as string)) as any;
  } else {
    return new _WalkerPath(child as any, path, key as string) as any;
  }
}
