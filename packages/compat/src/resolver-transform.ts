import CompatResolver, {
  default as Resolver,
  ComponentResolution,
  ComponentLocator,
  ResolutionFail,
  Resolution,
  ResolvedDep,
  HelperResolution,
  ModifierResolution,
  CompatResolverOptions,
  AuditMessage,
  builtInKeywords,
  Loc,
} from './resolver';
import type { ASTv1, ASTPlugin, ASTPluginBuilder, ASTPluginEnvironment, WalkerPath } from '@glimmer/syntax';
import type { WithJSUtils } from 'babel-plugin-ember-template-compilation';
import assertNever from 'assert-never';
import { explicitRelative } from '@embroider/core';
import { dirname, join } from 'path';
import { readJSONSync } from 'fs-extra';
import { dasherize } from './dasherize-component-name';

type Env = WithJSUtils<ASTPluginEnvironment> & {
  filename: string;
  contents: string;
  strict?: boolean;
  locals?: string[];
};

export interface Options {
  appRoot: string;
}

export const builtInModifiers = ['action', 'on'];

class TemplateResolver implements ASTPlugin {
  readonly name = 'embroider-build-time-resolver';

  private auditHandler: undefined | ((msg: AuditMessage) => void);

  private emittedAMDDeps: Set<string> = new Set();

  // The first time we insert a component as a lexical binding
  //   - if there's no JS-scope collision with the name, we're going to bind the existing name
  //     - in this case, any subsequent invocations of the same component just got automatically fixed too
  //     - but that means we need to remember that we did this, in order to
  //       give those other invocation sites support for features like argumentsAreComponents. That is what
  //       emittedLexicalBindings is for.
  //   - else there is a JS-scope collision, we're going to bind a mangled name and rewrite the callsite
  //     - in this case, subequent callsites will get their own independent
  //       resolution and they will get correctly aggregated by the
  //       jsutils.bindImport logic.
  private emittedLexicalBindings: Map<string, Resolution> = new Map();

  private scopeStack = new ScopeStack();

  constructor(private env: Env, private config: CompatResolverOptions, private resolver: CompatResolver) {
    if ((globalThis as any).embroider_audit) {
      this.auditHandler = (globalThis as any).embroider_audit;
    }
    const invokeDependencies = resolver.enter(this.env.filename);
    for (let packageRuleInvokeDependency of invokeDependencies) {
      this.emitAMD(packageRuleInvokeDependency.hbsModule);
      this.emitAMD(packageRuleInvokeDependency.jsModule);
    }
  }

  private relativeToFile(absPath: string): string {
    return explicitRelative(dirname(this.env.filename), absPath);
  }

  private emitAMD(dep: ResolvedDep | null) {
    if (dep && !this.emittedAMDDeps.has(dep.runtimeName)) {
      let parts = dep.runtimeName.split('/');
      let { absPath, runtimeName } = dep;
      this.env.meta.jsutils.emitExpression(context => {
        let identifier = context.import(this.relativeToFile(absPath), 'default', parts[parts.length - 1]);
        return `window.define("${runtimeName}", () => ${identifier})`;
      });
      this.emittedAMDDeps.add(dep.runtimeName);
    }
  }

  private emit<Target extends WalkerPath<ASTv1.Node>>(
    parentPath: Target,
    resolution: Resolution | null,
    setter: (target: Target['node'], newIdentifier: ASTv1.PathExpression) => void
  ) {
    switch (resolution?.type) {
      case 'error':
        this.reportError(resolution);
        return;
      case 'helper': {
        let name: string;
        if ('specifier' in resolution) {
          name = this.env.meta.jsutils.bindImport(resolution.specifier, 'default', parentPath, {
            nameHint: resolution.nameHint,
          });
        } else {
          name = this.env.meta.jsutils.bindImport(
            this.relativeToFile(resolution.module.absPath),
            'default',
            parentPath,
            {
              nameHint: resolution.nameHint,
            }
          );
        }
        this.emittedLexicalBindings.set(name, resolution);
        setter(parentPath.node, this.env.syntax.builders.path(name));
        return;
      }
      case 'modifier': {
        let name = this.env.meta.jsutils.bindImport(
          'specifier' in resolution ? resolution.specifier : this.relativeToFile(resolution.module.absPath),
          'default',
          parentPath,
          {
            nameHint: resolution.nameHint,
          }
        );
        this.emittedLexicalBindings.set(name, resolution);
        setter(parentPath.node, this.env.syntax.builders.path(name));
        return;
      }
      case 'component':
        if ('specifier' in resolution) {
          let name = this.env.meta.jsutils.bindImport(resolution.specifier, 'default', parentPath, {
            nameHint: resolution.nameHint,
          });
          this.emittedLexicalBindings.set(name, resolution);
          setter(parentPath.node, this.env.syntax.builders.path(name));
        } else {
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
            let name = this.env.meta.jsutils.bindImport(
              this.relativeToFile(resolution.jsModule.absPath),
              'default',
              parentPath,
              {
                nameHint: resolution.nameHint,
              }
            );
            this.emittedLexicalBindings.set(name, resolution);
            setter(parentPath.node, this.env.syntax.builders.path(name));
          } else {
            this.emitAMD(resolution.hbsModule);
            this.emitAMD(resolution.jsModule);
          }
        }
        return;
      case undefined:
        return;
      default:
        assertNever(resolution);
    }
  }

  private reportError(dep: ResolutionFail) {
    if (!this.auditHandler && !this.config.options.allowUnsafeDynamicComponents) {
      let e: any = new Error(`${dep.message}: ${dep.detail} in ${this.humanReadableFile(this.env.filename)}`);
      e.isTemplateResolverError = true;
      e.loc = dep.loc;
      e.moduleName = this.env.filename;
      throw e;
    }
    if (this.auditHandler) {
      this.auditHandler({
        message: dep.message,
        filename: this.env.filename,
        detail: dep.detail,
        loc: dep.loc,
        source: this.env.contents,
      });
    }
  }

  private humanReadableFile(file: string) {
    let { appRoot } = this.config;
    if (!appRoot.endsWith('/')) {
      appRoot += '/';
    }
    if (file.startsWith(appRoot)) {
      return file.slice(appRoot.length);
    }
    return file;
  }

  private handleComponentHelper(
    param: ASTv1.Node,
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
          return this.handleComponentHelper(param.path, impliedBecause);
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

    if (locator.type === 'path' && this.scopeStack.safeComponentInScope(locator.path)) {
      return null;
    }

    return this.resolveComponentHelper(locator, param.loc, impliedBecause);
  }

  private handleDynamicComponentArguments(
    componentName: string,
    argumentsAreComponents: string[],
    attributes: WalkerPath<ASTv1.AttrNode | ASTv1.HashPair>[]
  ) {
    for (let name of argumentsAreComponents) {
      let attr = attributes.find(attr => {
        if (attr.node.type === 'AttrNode') {
          return attr.node.name === '@' + name;
        } else {
          return attr.node.key === name;
        }
      });
      if (attr) {
        let resolution = this.handleComponentHelper(attr.node.value, {
          componentName,
          argumentName: name,
        });
        this.emit(attr, resolution, (node, newId) => {
          if (node.type === 'AttrNode') {
            node.value = this.env.syntax.builders.mustache(newId);
          } else {
            node.value = newId;
          }
        });
      }
    }
  }

  private get staticComponentsEnabled(): boolean {
    return this.config.options.staticComponents || Boolean(this.auditHandler);
  }

  private get staticHelpersEnabled(): boolean {
    return this.config.options.staticHelpers || Boolean(this.auditHandler);
  }

  private get staticModifiersEnabled(): boolean {
    return this.config.options.staticModifiers || Boolean(this.auditHandler);
  }

  private resolveComponent(name: string): ComponentResolution | null {
    if (!this.staticComponentsEnabled) {
      return null;
    }

    if (builtInKeywords.includes(name)) {
      return null;
    }
    if (this.resolver.isIgnoredComponent(name)) {
      return null;
    }

    let componentRules = this.resolver.rules.exteriorRules.get(name);
    return {
      type: 'component',
      specifier: `#embroider_compat/components/${name}`,
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: this.nameHint(name),
    };
  }

  private resolveComponentHelper(
    component: ComponentLocator,
    loc: Loc,
    impliedBecause?: { componentName: string; argumentName: string }
  ): ComponentResolution | ResolutionFail | null {
    if (!this.staticComponentsEnabled) {
      return null;
    }

    let message;
    if (impliedBecause) {
      message = `argument "${impliedBecause.argumentName}" to component "${impliedBecause.componentName}" is treated as a component, but the value you're passing is dynamic`;
    } else {
      message = `Unsafe dynamic component`;
    }

    if (component.type === 'other') {
      return {
        type: 'error',
        message,
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
    if (component.type === 'path') {
      let ownComponentRules = this.resolver.findInteriorRules(this.env.filename);
      if (ownComponentRules && ownComponentRules.safeInteriorPaths.includes(component.path)) {
        return null;
      }
      return {
        type: 'error',
        message,
        detail: component.path,
        loc,
      };
    }

    return this.resolveComponent(component.path);
  }

  private resolveHelper(path: string): HelperResolution | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }

    // people are not allowed to override the built-in helpers with their own
    // globally-named helpers. It throws an error. So it's fine for us to
    // prioritize the builtIns here without bothering to resolve a user helper
    // of the same name.
    if (builtInKeywords.includes(path)) {
      return null;
    }

    return {
      type: 'helper',
      specifier: `#embroider_compat/helpers/${path}`,
      nameHint: this.nameHint(path),
    };
  }

  private resolveHelperOrComponent(path: string, loc: Loc, hasArgs: boolean): ComponentResolution | null {
    /*

    In earlier embroider versions we would do a bunch of module resolution right
    here inside the ast transform to try to resolve the ambiguity of this case
    and if we didn't find anything, leave the template unchanged. But that leads
    to both a lot of extra build-time expense (since we are attempting
    resolution for lots of things that may in fact be just some data and not a
    component invocation at all, and also since we are pre-resolving modules
    that will get resolved a second time by the final stage packager).

    Now, we're going to be less forgiving, because it streamlines the build for
    everyone who's not still using these *extremely* old patterns.

    The problematic case is:

      1. In a non-strict template (because this whole resolver-transform.ts is a
         no-op on strict handlebars).

      2. Have a mustache statement like: `{{something}}`, where `something` is:

        a. Not a variable in scope (for example, there's no preceeding line 
           like `<Parent as |something|>`)
        b. Does not start with `@` because that must be an argument from outside this template.
        c. Does not contain a dot, like `some.thing` (because that case is classically 
           never a global component resolution that we would need to handle)
        d. Does not start with `this` (this rule is mostly redundant with the previous rule, 
           but even a standalone `this` is never a component invocation).
        e. Does not have any arguments. If there are argument like `{{something a=b}}`, 
           there is still ambiguity between helper vs component, but there is no longer 
           the possibility that this was just rendering some data.
        f. Does not take a block, like `{{#something}}{{/something}}` (because that is 
           always a component, no ambiguity.)

    We can't tell if this problematic case is really:

      1. A helper invocation with no arguments that is being directly rendered.
         Out-of-the-box, ember already generates [a lint
         error](https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/no-curly-component-invocation.md)
         for this, although it tells you to whitelist your helper when IMO it
         should tell you to use an unambiguous syntax like `{{ (something) }}`
         instead.

      2. A component invocation, which you could have written `<Something />`
         instead. Angle-bracket invocation has been available and easy-to-adopt
         for a very long time. 

      3. Property-this-fallback for `{{this.something}}`. Property-this-fallback
         is eliminated at Ember 4.0, so people have been heavily pushed to get
         it out of their addons.
    */

    // first, bail out on all the stuff we can obviously ignore
    if (
      (!this.staticHelpersEnabled && !this.staticComponentsEnabled) ||
      builtInKeywords.includes(path) ||
      this.resolver.isIgnoredComponent(path)
    ) {
      return null;
    }

    if (!hasArgs && !path.includes('/') && !path.includes('@')) {
      // this is the case that could also be property-this-fallback. We're going
      // to force people to disambiguate, because letting a potential component
      // or helper invocation lurk inside every bit of data you render is not
      // ok.
      this.reportError({
        type: 'error',
        message: 'unsupported ambiguous syntax',
        detail: `"{{${path}}}" is ambiguous and could mean "{{this.${path}}}" or component "<${capitalize(
          path
        )} />" or helper "{{ (${path}) }}".`,
        loc,
      });
      return null;
    }

    // Above we already bailed out if both of these were disabled, so we know at
    // least one is turned on. If both aren't turned on, we're stuck, because we
    // can't even tell if this *is* a component vs a helper.
    if (!this.staticHelpersEnabled || !this.staticComponentsEnabled) {
      this.reportError({
        type: 'error',
        message: 'unsupported ambiguity between helper and component',
        detail: `this use of "${path}" could be a helper or a component, and your settings for staticHelpersEnabled and staticComponentsEnable do not agree`,
        loc,
      });
      return null;
    }

    let componentRules = this.resolver.rules.exteriorRules.get(path);
    return {
      type: 'component',
      specifier: `#embroider_compat/ambiguous/${path}`,
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: this.nameHint(path),
    };
  }

  private resolveElementModifierStatement(path: string): ModifierResolution | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }
    if (builtInModifiers.includes(path)) {
      return null;
    }

    return {
      type: 'modifier',
      specifier: `#embroider_compat/modifiers/${path}`,
      nameHint: this.nameHint(path),
    };
  }

  resolveDynamicModifier(modifier: ComponentLocator, loc: Loc): ModifierResolution | ResolutionFail | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }

    if (modifier.type === 'literal') {
      return this.resolveElementModifierStatement(modifier.path);
    } else {
      return {
        type: 'error',
        message: 'Unsafe dynamic modifier',
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
  }

  private resolveDynamicHelper(helper: ComponentLocator): HelperResolution | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }

    if (helper.type === 'literal') {
      return this.resolveHelper(helper.path);
    }

    // we don't have to manage any errors in this case because ember itself
    // considers it an error to pass anything but a string literal to the
    // `helper` helper.
    return null;
  }

  private nameHint(path: string) {
    let parts = path.split('@');
    return '$' + parts[parts.length - 1];
  }

  private handleDynamicModifier(param: ASTv1.Expression): ModifierResolution | ResolutionFail | null {
    if (param.type === 'StringLiteral') {
      return this.resolveDynamicModifier({ type: 'literal', path: param.value }, param.loc);
    }
    // we don't have to manage any errors in this case because ember itself
    // considers it an error to pass anything but a string literal to the
    // modifier helper.
    return null;
  }

  private handleDynamicHelper(param: ASTv1.Expression): HelperResolution | ResolutionFail | null {
    // We only need to handle StringLiterals since Ember already throws an error if unsupported values
    // are passed to the helper keyword.
    // If a helper reference is passed in we don't need to do anything since it's either the result of a previous
    // helper keyword invocation, or a helper reference that was imported somewhere.
    if (param.type === 'StringLiteral') {
      return this.resolveDynamicHelper({ type: 'literal', path: param.value });
    }
    return null;
  }

  visitor: ASTPlugin['visitor'] = {
    Program: {
      enter: node => {
        this.scopeStack.push(node.blockParams);
        if (this.env.locals) {
          this.scopeStack.push(this.env.locals);
        }
      },
      exit: () => {
        this.scopeStack.pop();
        if (this.env.locals) {
          this.scopeStack.pop();
        }
      },
    },
    BlockStatement: (node, path) => {
      if (node.path.type !== 'PathExpression') {
        return;
      }
      let rootName = node.path.parts[0];
      if (this.scopeStack.inScope(rootName)) {
        let resolution = this.emittedLexicalBindings.get(rootName);
        if (resolution?.type === 'component') {
          this.scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
            this.handleDynamicComponentArguments(
              rootName,
              argumentsAreComponents,
              extendPath(extendPath(path, 'hash'), 'pairs')
            );
          });
        }
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
        let resolution = this.handleComponentHelper(node.params[0]);
        this.emit(path, resolution, (node, newIdentifier) => {
          node.params[0] = newIdentifier;
        });
        return;
      }
      let resolution = this.resolveComponent(node.path.original);
      this.emit(path, resolution, (node, newId) => {
        node.path = newId;
      });
      if (resolution?.type === 'component') {
        this.scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
          this.handleDynamicComponentArguments(
            rootName,
            argumentsAreComponents,
            extendPath(extendPath(path, 'hash'), 'pairs')
          );
        });
      }
    },
    SubExpression: (node, path) => {
      if (node.path.type !== 'PathExpression') {
        return;
      }
      if (node.path.this === true) {
        return;
      }
      if (this.scopeStack.inScope(node.path.parts[0])) {
        return;
      }
      if (node.path.original === 'component' && node.params.length > 0) {
        let resolution = this.handleComponentHelper(node.params[0]);
        this.emit(path, resolution, (node, newId) => {
          node.params[0] = newId;
        });
        return;
      }
      if (node.path.original === 'helper' && node.params.length > 0) {
        let resolution = this.handleDynamicHelper(node.params[0]);
        this.emit(path, resolution, (node, newId) => {
          node.params[0] = newId;
        });
        return;
      }
      if (node.path.original === 'modifier' && node.params.length > 0) {
        let resolution = this.handleDynamicModifier(node.params[0]);
        this.emit(path, resolution, (node, newId) => {
          node.params[0] = newId;
        });
        return;
      }
      let resolution = this.resolveHelper(node.path.original);
      this.emit(path, resolution, (node, newId) => {
        node.path = newId;
      });
    },
    MustacheStatement: {
      enter: (node, path) => {
        if (node.path.type !== 'PathExpression') {
          return;
        }
        let rootName = node.path.parts[0];
        if (this.scopeStack.inScope(rootName)) {
          let resolution = this.emittedLexicalBindings.get(rootName);
          if (resolution && resolution.type === 'component') {
            this.handleDynamicComponentArguments(
              rootName,
              resolution.argumentsAreComponents,
              extendPath(extendPath(path, 'hash'), 'pairs')
            );
          }
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
        if (node.path.original.startsWith('@')) {
          // similarly, global resolution of helpers and components never
          // happens with argument paths (it could still be an invocation, but
          // it would be a lexically-scoped invocation, not one we need to
          // adjust)
          return;
        }
        if (node.path.original === 'component' && node.params.length > 0) {
          let resolution = this.handleComponentHelper(node.params[0]);
          this.emit(path, resolution, (node, newId) => {
            node.params[0] = newId;
          });
          return;
        }
        if (node.path.original === 'helper' && node.params.length > 0) {
          let resolution = this.handleDynamicHelper(node.params[0]);
          this.emit(path, resolution, (node, newIdentifier) => {
            node.params[0] = newIdentifier;
          });
          return;
        }
        let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
        let resolution = this.resolveHelperOrComponent(node.path.original, node.path.loc, hasArgs);
        this.emit(path, resolution, (node, newIdentifier) => {
          node.path = newIdentifier;
        });
        if (resolution?.type === 'component') {
          this.handleDynamicComponentArguments(
            node.path.original,
            resolution.argumentsAreComponents,
            extendPath(extendPath(path, 'hash'), 'pairs')
          );
        }
      },
    },
    ElementModifierStatement: (node, path) => {
      if (node.path.type !== 'PathExpression') {
        return;
      }
      if (this.scopeStack.inScope(node.path.parts[0])) {
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

      let resolution = this.resolveElementModifierStatement(node.path.original);
      this.emit(path, resolution, (node, newId) => {
        node.path = newId;
      });
    },
    ElementNode: {
      enter: (node, path) => {
        let rootName = node.tag.split('.')[0];
        if (this.scopeStack.inScope(rootName)) {
          const resolution = this.emittedLexicalBindings.get(rootName);
          if (resolution?.type === 'component') {
            this.scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
              this.handleDynamicComponentArguments(node.tag, argumentsAreComponents, extendPath(path, 'attributes'));
            });
          }
        } else {
          let resolution: ComponentResolution | null = null;

          // if it starts with lower case, it can't be a component we need to
          // globally resolve
          if (node.tag[0] !== node.tag[0].toLowerCase()) {
            resolution = this.resolveComponent(dasherize(node.tag));
          }

          this.emit(path, resolution, (node, newId) => {
            node.tag = newId.original;
          });
          if (resolution?.type === 'component') {
            this.scopeStack.enteringComponentBlock(resolution, ({ argumentsAreComponents }) => {
              this.handleDynamicComponentArguments(node.tag, argumentsAreComponents, extendPath(path, 'attributes'));
            });
          }
        }
        this.scopeStack.push(node.blockParams);
      },
      exit: () => {
        this.scopeStack.pop();
      },
    },
  };
}

// This is the AST transform that resolves components, helpers and modifiers at build time
export default function makeResolverTransform({ appRoot }: Options) {
  let config: CompatResolverOptions = readJSONSync(join(appRoot, '.embroider', 'resolver.json'));
  let resolver = new CompatResolver(config);
  const resolverTransform: ASTPluginBuilder<Env> = env => {
    if (env.strict) {
      return {
        name: 'embroider-build-time-resolver-strict-noop',
        visitor: {},
      };
    }
    return new TemplateResolver(env, config, resolver);
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

function capitalize(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}
