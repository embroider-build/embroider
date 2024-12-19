import type { ASTv1, ASTPlugin, ASTPluginBuilder, ASTPluginEnvironment, WalkerPath } from '@glimmer/syntax';
import type {
  PreprocessedComponentRule,
  ActivePackageRules,
  ComponentRules,
  PackageRules,
  ModuleRules,
} from './dependency-rules';
import { preprocessComponentRule, appTreeRulesDir } from './dependency-rules';
import { Memoize } from 'typescript-memoize';
import type { WithJSUtils } from 'babel-plugin-ember-template-compilation';
import assertNever from 'assert-never';
import { join, sep } from 'path';
import { dasherize, snippetToDasherizedName } from './dasherize-component-name';
import type { ResolverOptions as CoreResolverOptions } from '@embroider/core';
import { Resolver, ResolverLoader, cleanUrl } from '@embroider/core';
import type CompatOptions from './options';
import type { AuditMessage, Loc } from './audit';
import { camelCase, mergeWith } from 'lodash';
import { satisfies } from 'semver';

type Env = WithJSUtils<ASTPluginEnvironment> & {
  filename: string;
  contents: string;
  strictMode?: boolean;
  locals?: string[];
};

// this is a subset of the full Options. We care about serializability, and we
// only needs parts that are easily serializable, which is why we don't keep the
// whole thing.
type UserConfig = Pick<
  Required<CompatOptions>,
  'staticHelpers' | 'staticModifiers' | 'staticComponents' | 'allowUnsafeDynamicComponents'
>;

export interface CompatResolverOptions extends CoreResolverOptions {
  activePackageRules: ActivePackageRules[];
  options: UserConfig;
}

export interface ExternalNameHint {
  (path: string): string | null;
}

export interface Options {
  appRoot: string;
  emberVersion: string;
  externalNameHint?: ExternalNameHint;
}

type BuiltIn = {
  importableHelper?: [string, string];
  importableComponent?: [string, string];
  importableModifier?: [string, string];
};

function builtInKeywords(emberVersion: string): Record<string, BuiltIn | undefined> {
  const builtInKeywords: Record<string, BuiltIn | undefined> = {
    '-get-dynamic-var': {},
    '-in-element': {},
    '-with-dynamic-vars': {},
    action: {},
    array: {
      importableHelper: ['array', '@ember/helper'],
    },
    component: {},
    concat: {
      importableHelper: ['concat', '@ember/helper'],
    },
    debugger: {},
    'each-in': {},
    each: {},
    fn: {
      importableHelper: ['fn', '@ember/helper'],
    },
    get: {
      importableHelper: ['get', '@ember/helper'],
    },
    'has-block-params': {},
    'has-block': {},
    hasBlock: {},
    hasBlockParams: {},
    hash: {
      importableHelper: ['hash', '@ember/helper'],
    },
    helper: {},
    if: {},
    'in-element': {},
    input: {
      importableComponent: ['Input', '@ember/component'],
    },
    let: {},
    'link-to': {
      importableComponent: ['LinkTo', '@ember/routing'],
    },
    loc: {},
    log: {},
    modifier: {},
    mount: {},
    mut: {},
    on: {
      importableModifier: ['on', '@ember/modifier'],
    },
    outlet: {},
    partial: {},
    'query-params': {},
    readonly: {},
    textarea: {
      importableComponent: ['Textarea', '@ember/component'],
    },
    unbound: {},
    'unique-id': {},
    unless: {},
    with: {},
    yield: {},
  };
  if (satisfies(emberVersion, '>=5.2')) {
    builtInKeywords['unique-id'] = {
      importableHelper: ['uniqueId', '@ember/helper'],
    };
  }
  return builtInKeywords;
}

interface ComponentResolution {
  type: 'component';
  specifier: string;
  importedName: string;
  yieldsComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
  nameHint: string;
}

type HelperResolution = {
  type: 'helper';
  nameHint: string;
  specifier: string;
  importedName: string;
};

type ModifierResolution = {
  type: 'modifier';
  specifier: string;
  importedName: string;
  nameHint: string;
};

type ResolutionResult = ComponentResolution | HelperResolution | ModifierResolution;

interface ResolutionFail {
  type: 'error';
  message: string;
  detail: string;
  loc: Loc;
}

type Resolution = ResolutionResult | ResolutionFail;

type ComponentLocator =
  | {
      type: 'literal';
      path: string;
    }
  | {
      type: 'path';
      path: string;
    }
  | {
      type: 'other';
    };

class TemplateResolver implements ASTPlugin {
  readonly name = 'embroider-build-time-resolver';

  private auditHandler: undefined | ((msg: AuditMessage) => void);
  private scopeStack = new ScopeStack();

  private moduleResolver: Resolver;

  constructor(
    private env: Env,
    private config: CompatResolverOptions,
    private builtInsForEmberVersion: ReturnType<typeof builtInKeywords>,
    private externalNameHint?: ExternalNameHint
  ) {
    this.moduleResolver = new Resolver(config);
    if ((globalThis as any).embroider_audit) {
      this.auditHandler = (globalThis as any).embroider_audit;
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
      case 'component':
      case 'modifier':
      case 'helper': {
        let name = this.env.meta.jsutils.bindImport(resolution.specifier, resolution.importedName, parentPath, {
          nameHint: resolution.nameHint,
        });
        setter(parentPath.node, this.env.syntax.builders.path(name));
        return;
      }
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
    if (!appRoot.endsWith(sep)) {
      appRoot += sep;
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

    return this.targetComponentHelper(locator, param.loc, impliedBecause);
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
    if (!this.config?.options) {
      return true;
    }
    return this.config.options.staticComponents || Boolean(this.auditHandler);
  }

  private get staticHelpersEnabled(): boolean {
    if (!this.config?.options) {
      return true;
    }
    return this.config.options.staticHelpers || Boolean(this.auditHandler);
  }

  private get staticModifiersEnabled(): boolean {
    if (!this.config?.options) {
      return true;
    }
    return this.config.options.staticModifiers || Boolean(this.auditHandler);
  }

  private isIgnoredComponent(dasherizedName: string) {
    return this.rules.components.get(dasherizedName)?.safeToIgnore;
  }

  @Memoize()
  private get rules() {
    // rules that are keyed by the filename they're talking about
    let files: Map<string, PreprocessedComponentRule> = new Map();

    // rules that are keyed by our dasherized interpretation of the component's name
    let components: Map<string, PreprocessedComponentRule> = new Map();

    // we're not responsible for filtering out rules for inactive packages here,
    // that is done before getting to us. So we should assume these are all in
    // force.
    for (let rule of this.config?.activePackageRules ?? []) {
      if (rule.components) {
        for (let [snippet, rules] of Object.entries(rule.components)) {
          let processedRules = preprocessComponentRule(rules);
          let dasherizedName = this.standardDasherize(snippet, rule);
          components.set(dasherizedName, processedRules);
          if (rules.layout) {
            for (let root of rule.roots) {
              if (rules.layout.addonPath) {
                files.set(join(root, rules.layout.addonPath), processedRules);
              }
              if (rules.layout.appPath) {
                files.set(join(root, rules.layout.appPath), processedRules);
              }
            }
          }
        }
      }
      if (rule.appTemplates) {
        for (let [path, templateRules] of Object.entries(rule.appTemplates)) {
          let processedRules = preprocessComponentRule(templateRules);
          for (let root of rule.roots) {
            files.set(join(appTreeRulesDir(root, this.moduleResolver), path), processedRules);
          }
        }
      }
      if (rule.addonTemplates) {
        for (let [path, templateRules] of Object.entries(rule.addonTemplates)) {
          let processedRules = preprocessComponentRule(templateRules);
          for (let root of rule.roots) {
            files.set(join(root, path), processedRules);
          }
        }
      }
    }
    return { files, components };
  }

  private findRules(absPath: string): PreprocessedComponentRule | undefined {
    // when babel is invoked by vite our filenames can have query params still
    // hanging off them. That would break rule matching.
    absPath = cleanUrl(absPath);

    let fileRules = this.rules.files.get(absPath);
    let componentRules: PreprocessedComponentRule | undefined;

    let componentName = this.moduleResolver.reverseComponentLookup(absPath);
    if (componentName) {
      componentRules = this.rules.components.get(componentName);
    }

    if (fileRules && componentRules) {
      return mergeWith(fileRules, componentRules, appendArrays);
    }

    return fileRules ?? componentRules;
  }

  private standardDasherize(snippet: string, rule: PackageRules | ModuleRules): string {
    let name = snippetToDasherizedName(snippet);
    if (name == null) {
      throw new Error(`unable to parse component snippet "${snippet}" from rule ${JSON.stringify(rule, null, 2)}`);
    }
    return name;
  }

  private targetComponent(name: string): ComponentResolution | null {
    if (!this.staticComponentsEnabled) {
      return null;
    }

    const builtIn = this.builtInsForEmberVersion[name];

    if (builtIn?.importableComponent) {
      let [importedName, specifier] = builtIn.importableComponent;
      return {
        type: 'component',
        specifier,
        importedName,
        yieldsComponents: [],
        yieldsArguments: [],
        argumentsAreComponents: [],
        nameHint: importedName,
      };
    }

    if (builtIn) {
      return null;
    }
    if (this.isIgnoredComponent(name)) {
      return null;
    }

    let componentRules = this.rules.components.get(name);
    return {
      type: 'component',
      specifier: `@embroider/virtual/components/${name}`,
      importedName: 'default',
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: this.nameHint(name),
    };
  }

  private targetComponentHelper(
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
      if (this.ownRules?.safeInteriorPaths.includes(component.path)) {
        return null;
      }
      return {
        type: 'error',
        message,
        detail: component.path,
        loc,
      };
    }

    return this.targetComponent(component.path);
  }

  private targetHelper(path: string): HelperResolution | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }

    // people are not allowed to override the built-in helpers with their own
    // globally-named helpers. It throws an error. So it's fine for us to
    // prioritize the builtIns here without bothering to resolve a user helper
    // of the same name.
    const builtIn = this.builtInsForEmberVersion[path];

    if (builtIn?.importableHelper) {
      let [importedName, specifier] = builtIn.importableHelper;
      return {
        type: 'helper',
        specifier,
        importedName,
        nameHint: importedName,
      };
    }

    if (builtIn) {
      return null;
    }

    return {
      type: 'helper',
      specifier: `@embroider/virtual/helpers/${path}`,
      importedName: 'default',
      nameHint: this.nameHint(path),
    };
  }

  private targetHelperOrComponent(
    path: string,
    loc: Loc,
    hasArgs: boolean
  ): ComponentResolution | HelperResolution | null {
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
    if ((!this.staticHelpersEnabled && !this.staticComponentsEnabled) || this.isIgnoredComponent(path)) {
      return null;
    }

    let builtIn = this.builtInsForEmberVersion[path];

    if (builtIn?.importableComponent) {
      let [importedName, specifier] = builtIn.importableComponent;
      return {
        type: 'component',
        specifier,
        importedName,
        yieldsComponents: [],
        yieldsArguments: [],
        argumentsAreComponents: [],
        nameHint: importedName,
      };
    }

    if (builtIn?.importableHelper) {
      let [importedName, specifier] = builtIn.importableHelper;
      return {
        type: 'helper',
        specifier,
        importedName,
        nameHint: importedName,
      };
    }

    if (builtIn) {
      return null;
    }

    let ownComponentRules = this.findRules(this.env.filename);
    if (ownComponentRules?.disambiguate[path]) {
      switch (ownComponentRules.disambiguate[path]) {
        case 'component':
          return this.targetComponent(path);
        case 'helper':
          return this.targetHelper(path);
        case 'data':
          return null;
      }
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
          camelCase(path)
        )} />" or helper "{{ (${path}) }}". Change it to one of those unambigous forms, or use a "disambiguate" packageRule to work around the problem if its in third-party code you cannot easily fix.`,
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
        detail: `this use of "{{${path}}}" could be helper "{{ (${path}) }}" or component "<${capitalize(
          camelCase(path)
        )} />", and your settings for staticHelpers and staticComponents do not agree. Either switch to one of the unambiguous forms, or make staticHelpers and staticComponents agree, or use a "disambiguate" packageRule to work around the problem if its in third-party code you cannot easily fix.`,
        loc,
      });
      return null;
    }

    let componentRules = this.rules.components.get(path);
    return {
      type: 'component',
      specifier: `@embroider/virtual/ambiguous/${path}`,
      importedName: 'default',
      yieldsComponents: componentRules ? componentRules.yieldsSafeComponents : [],
      yieldsArguments: componentRules ? componentRules.yieldsArguments : [],
      argumentsAreComponents: componentRules ? componentRules.argumentsAreComponents : [],
      nameHint: this.nameHint(path),
    };
  }

  private targetElementModifier(path: string): ModifierResolution | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }

    const builtIn = this.builtInsForEmberVersion[path];
    if (builtIn?.importableModifier) {
      let [importedName, specifier] = builtIn.importableModifier;
      return {
        type: 'modifier',
        specifier,
        importedName,
        nameHint: importedName,
      };
    }

    if (builtIn) {
      return null;
    }

    return {
      type: 'modifier',
      specifier: `@embroider/virtual/modifiers/${path}`,
      importedName: 'default',
      nameHint: this.nameHint(path),
    };
  }

  targetDynamicModifier(modifier: ComponentLocator, loc: Loc): ModifierResolution | ResolutionFail | null {
    if (!this.staticModifiersEnabled) {
      return null;
    }

    if (modifier.type === 'literal') {
      return this.targetElementModifier(modifier.path);
    } else {
      return {
        type: 'error',
        message: 'Unsafe dynamic modifier',
        detail: `cannot statically analyze this expression`,
        loc,
      };
    }
  }

  private targetDynamicHelper(helper: ComponentLocator): HelperResolution | null {
    if (!this.staticHelpersEnabled) {
      return null;
    }

    if (helper.type === 'literal') {
      return this.targetHelper(helper.path);
    }

    // we don't have to manage any errors in this case because ember itself
    // considers it an error to pass anything but a string literal to the
    // `helper` helper.
    return null;
  }

  private nameHint(path: string) {
    let parts = path.split('@');

    // the extra underscore here guarantees that we will never collide with an
    // HTML element.
    return this.externalNameHint?.(path) ?? parts[parts.length - 1] + '_';
  }

  private handleDynamicModifier(param: ASTv1.Expression): ModifierResolution | ResolutionFail | null {
    if (param.type === 'StringLiteral') {
      return this.targetDynamicModifier({ type: 'literal', path: param.value }, param.loc);
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
      return this.targetDynamicHelper({ type: 'literal', path: param.value });
    }
    return null;
  }

  private ownRules: PreprocessedComponentRule | undefined;

  private implementInvokesRule(node: ASTv1.Template, path: WalkerPath<ASTv1.Template>) {
    if (!this.ownRules?.invokes) {
      return;
    }
    let registrations: ASTv1.HashPair[] = [];
    for (let snippets of Object.values(this.ownRules.invokes)) {
      for (let snippet of snippets) {
        let dasherizedName = snippetToDasherizedName(snippet);
        if (!dasherizedName) {
          throw new Error(`Package rule contains unparseable component snippet: ${snippet}`);
        }
        let resolution = this.targetComponentHelper({ type: 'literal', path: dasherizedName }, node.loc);
        this.emit(path, resolution, (_target, id) => {
          registrations.push(this.env.syntax.builders.pair(dasherizedName, id));
        });
      }
    }
    if (registrations.length > 0) {
      node.body.unshift(
        this.env.syntax.builders.mustache(
          this.env.meta.jsutils.bindExpression(registrationHelper, path, { nameHint: 'registerComponents' }),
          [],
          this.env.syntax.builders.hash(registrations)
        )
      );
    }
  }

  visitor: ASTPlugin['visitor'] = {
    Template: {
      enter: (node, path) => {
        this.ownRules = this.findRules(this.env.filename);
        this.implementInvokesRule(node, path);
        if (this.env.locals) {
          this.scopeStack.pushMustacheBlock(this.env.locals);
        }
      },
      exit: () => {
        if (this.env.locals) {
          this.scopeStack.pop();
        }
      },
    },
    Block: {
      enter: node => {
        this.scopeStack.pushMustacheBlock(node.blockParams);
      },
      exit: () => {
        this.scopeStack.pop();
      },
    },
    BlockStatement: (node, path) => {
      if (node.path.type !== 'PathExpression') {
        return;
      }
      let rootName = headOf(node.path);
      if (this.scopeStack.inScope(rootName, path)) {
        return;
      }
      if (isThisHead(node.path)) {
        return;
      }
      if (parts(node.path).length > 1) {
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
      let resolution = this.targetComponent(node.path.original);
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
      if (isThisHead(node.path)) {
        return;
      }
      if (this.scopeStack.inScope(headOf(node.path), path)) {
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
      if (node.path.tail.length === 0 && node.path.head.type === 'VarHead') {
        let resolution = this.targetHelper(node.path.original);
        this.emit(path, resolution, (node, newId) => {
          node.path = newId;
        });
      }
    },
    MustacheStatement: {
      enter: (node, path) => {
        if (node.path.type !== 'PathExpression') {
          return;
        }
        let rootName = headOf(node.path);
        if (this.scopeStack.inScope(rootName, path)) {
          return;
        }
        if (isThisHead(node.path)) {
          return;
        }
        if (parts(node.path).length > 1) {
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
        if (path.parent?.node.type === 'AttrNode') {
          // this mustache is the value of an attribute. Components aren't
          // allowed here, so we're not ambiguous, so resolve a helper.
          let resolution = this.targetHelper(node.path.original);
          this.emit(path, resolution, (node, newIdentifier) => {
            node.path = newIdentifier;
          });
          return;
        }
        let hasArgs = node.params.length > 0 || node.hash.pairs.length > 0;
        let resolution = this.targetHelperOrComponent(node.path.original, node.path.loc, hasArgs);
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
      if (this.scopeStack.inScope(headOf(node.path), path)) {
        return;
      }
      if (isThisHead(node.path)) {
        return;
      }
      if (isAtHead(node.path)) {
        return;
      }
      if (parts(node.path).length > 1) {
        // paths with a dot in them (which therefore split into more than
        // one "part") are classically understood by ember to be contextual
        // components. With the introduction of `Template strict mode` in Ember 3.25
        // it is also possible to pass modifiers this way which means there's nothing
        // to resolve at this location.
        return;
      }

      let resolution = this.targetElementModifier(node.path.original);
      this.emit(path, resolution, (node, newId) => {
        node.path = newId;
      });
    },
    ElementNode: {
      enter: (node, path) => {
        let rootName = node.tag.split('.')[0];
        if (!this.scopeStack.inScope(rootName, path)) {
          let resolution: ComponentResolution | null = null;

          // if it starts with lower case, it can't be a component we need to
          // globally resolve
          if (node.tag[0] !== node.tag[0].toLowerCase()) {
            resolution = this.targetComponent(dasherize(node.tag));
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
        this.scopeStack.pushElementBlock(node.blockParams, node);
      },
      exit: () => {
        this.scopeStack.pop();
      },
    },
  };
}

// This is the AST transform that resolves components, helpers and modifiers at build time
export default function makeResolverTransform({ appRoot, emberVersion, externalNameHint }: Options) {
  let loader = new ResolverLoader(appRoot);
  let config = loader.resolver.options as CompatResolverOptions;
  const resolverTransform: ASTPluginBuilder<Env> = env => {
    if (env.strictMode) {
      return {
        name: 'embroider-build-time-resolver-strict-noop',
        visitor: {},
      };
    }
    return new TemplateResolver(env, config, builtInKeywords(emberVersion), externalNameHint);
  };
  (resolverTransform as any).parallelBabel = {
    requireFile: __filename,
    buildUsing: 'makeResolverTransform',
    params: { appRoot: appRoot },
  };
  return resolverTransform;
}

interface ComponentBlockMarker {
  type: 'componentBlockMarker';
  resolution: ComponentResolution;
  argumentsAreComponents: string[];
  exit: (marker: ComponentBlockMarker) => void;
}

type ScopeEntry =
  | { type: 'mustache'; blockParams: string[] }
  | { type: 'element'; blockParams: string[]; childrenOf: ASTv1.ElementNode }
  | ComponentBlockMarker;

class ScopeStack {
  private stack: ScopeEntry[] = [];

  // mustache blocks like:
  //
  //   {{#stuff as |some block vars|}}
  //
  // are relatively simple for us because there's a dedicated `Block` AST node
  // that exactly covers the range in which the variables are in scope.
  pushMustacheBlock(blockParams: string[]) {
    this.stack.unshift({ type: 'mustache', blockParams });
  }

  // element blocks like:
  //
  //  <Stuff as |some block vars|>
  //
  // are *not* so simple for us because there's no single AST node that exactly
  // covers the range in which the variables are in scope. For example, the
  // *attributes* of the element do not see the variables, but the children of
  // the element do.
  pushElementBlock(blockParams: string[], childrenOf: ASTv1.ElementNode) {
    this.stack.unshift({ type: 'element', blockParams, childrenOf });
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

  inScope(name: string, fromPath: WalkerPath<ASTv1.Node>) {
    for (let scope of this.stack) {
      if (scope.type === 'mustache' && scope.blockParams.includes(name)) {
        return true;
      }
      if (
        scope.type === 'element' &&
        scope.blockParams.includes(name) &&
        withinElementBlock(fromPath, scope.childrenOf)
      ) {
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
      if ((here.type === 'mustache' || here.type === 'element') && next.type === 'componentBlockMarker') {
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

// ElementNodes have both children and attributes and both of those are
// "children" in the abstract syntax tree sense, but here we want to distinguish
// between them.
function withinElementBlock(childPath: WalkerPath<ASTv1.Node>, ancestorNode: ASTv1.ElementNode): Boolean {
  let cursor: WalkerPath<ASTv1.Node> | null = childPath;
  while (cursor && cursor.node !== ancestorNode) {
    if (ancestorNode.children.includes(cursor.node as ASTv1.Statement)) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}
function appendArrays(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function headOf(path: any) {
  if (!path) return;

  return 'head' in path ? path.head.name : path.parts[0];
}

function isThisHead(path: any) {
  if (!path) return;

  if ('head' in path) {
    return path.head.type === 'ThisHead';
  }

  return path.this === true;
}

function isAtHead(path: any) {
  if (!path) return;

  if ('head' in path) {
    return path.head.type === 'AtHead';
  }

  return path.data === true;
}

function parts(path: any) {
  if (!path) return;

  return 'original' in path ? path.original.split('.') : path.parts;
}

function registrationHelper(context: { import: (module: string, name: string, hint?: string) => string }) {
  let Helper = context.import('@ember/component/helper', 'default', 'Helper');
  let getOwner = context.import('@ember/owner', 'getOwner');
  return `
    (class extends ${Helper} {
      compute(_positional, registrations) {
        let owner = ${getOwner}(this);
        for (let [name, definition] of Object.entries(registrations)) {
          owner.register(\`component:\${name}\`, definition);
        }
      }
    })
  `;
}
