import type { Resolver } from '@embroider/core';
import { getOrCreate } from '@embroider/core';
import { resolve as pathResolve, dirname } from 'path';
import { satisfies } from 'semver';
import { resolve as resolveExports } from 'resolve.exports';

export interface PackageRules {
  // This whole set of rules will only apply when the given addon package
  // matching the given semver range is present and active.
  package: string;
  semverRange?: string;

  components?: {
    // I would prefer to write the key type here as `ComponentSnippet` to aid
    // documentation, but Typescript won't allow it. See ComponentSnippet below.
    [key: string]: ComponentRules;
  };

  addonModules?: {
    // `filename` is relative to your package root, and it assumes v2 package
    // format. Like "templates/components/foo.hbs".
    [filename: string]: ModuleRules;
  };

  appModules?: {
    // `filename` is relative to the app's root, and it assumes v2 package
    // format. Like "templates/components/foo.hbs".
    [filename: string]: ModuleRules;
  };

  addonTemplates?: {
    // `filename` is relative to your package root, and it assumes v2 package
    // format. Like "templates/foo.hbs".
    [filename: string]: TemplateRules;
  };

  appTemplates?: {
    // `filename` is relative to the app's root, and it assumes v2 package
    // format. Like "templates/foo.hbs".
    [filename: string]: TemplateRules;
  };
}

export interface ActivePackageRules extends PackageRules {
  // the location(s) of active packages that match this rule.
  roots: string[];
}

export interface TemplateRules {
  // Tells embroider which list of components may be needed for a given path.
  // For example, if your template says `{{component this.panel}}` and you know
  // that `this.panel` can be either "light-panel" or "dark-panel", you would
  // say: `invokes: { "this.panel": ["<LightPanel/>", "<DarkPanel/>"] }`
  invokes?: {
    [path: string]: ComponentSnippet[];
  };

  // Embroider will complain if you try to use staticHelper and/or
  // staticComponents and you have ambiguous forms that might be a component or
  // a helper or just some data that is being rendered. For example, if a
  // template says `{{something}}`, we can't tell if that is `<Something />` or
  // `{{ (something) }}` or `{{this.something}}`.
  disambiguate?: {
    [dasherizedName: string]: 'component' | 'helper' | 'data';
  };
}

export interface ComponentRules extends TemplateRules {
  // This declares that our component yields other components that are safe to
  // invoke with the {{component}} helper.
  //
  // The array corresponds to your yielded positional arguments. Any value that
  // is true is considered a safe component. Any value can be a hash in which
  // individual keys that are true are considered safe components.
  //
  //  Examples:
  //
  //    If you do: {{yield (component "x") }}
  //    Then say: yieldsSafeComponents: [true]
  //
  //    If you do: {{yield (hash x=(component "x") y=(component "y")) }}
  //    Then say: yieldsSafeComponents: [{x: true, y: true}]
  //
  yieldsSafeComponents?: (boolean | { [name: string]: boolean })[];

  // This declares that our component yields some of its arguments unchanged.
  //
  // The array corresponds to your yielded positional arguments. Each value can
  // be:
  //   false, meaning this yielded value is not one of our arguments
  //   a string, meaning this yielded value is our argument with that name
  //   or a POJO, whose individual properties are string naming which arguments
  //     from whence they came.
  //
  // Examples:
  //
  //    If you do: {{yield @foo}}
  //    Then say: yieldsArguments: ['foo']
  //
  //    If you do: {{yield (hash x=@foo) }}
  //    Then say: yieldsArguments: [{ x: 'foo' }]
  yieldsArguments?: (string | { [name: string]: string })[];

  // This declares that our component accepts arguments that will be invoked
  // with the {{component}} helper. This silences warnings in the places where
  // we consume them, while introducing warnings in the places where people are
  // passing them to us (if they are doing so in a way that is too dynamic to
  // analyze).
  //
  // If you use this, you may also need to set `layout`, see below.
  acceptsComponentArguments?: ArgumentMapping[];

  // If you want to use `acceptsComponentArguments` on a component that
  // customies its own `layout` (which is most addon-provided components), you
  // need to tell us here how to find its template by setting either `addonPath`
  // or `appPath`.
  layout?: {
    // This is a path relative to the addon root, assuming V2 format.
    addonPath?: string;
    // This is the path relative to the app root, assuming V2 format.
    appPath?: string;
  };

  // An unresolvable component is usually a build error (when your app has the
  // staticComponent Option enabled). But you can tell Embroider to ignore it by
  // setting this.
  safeToIgnore?: boolean;
}

export interface ModuleRules {
  // We will resolve these components into the corresponding JS and HBS files
  // and generate imports such that this module depends on them.
  dependsOnComponents?: ComponentSnippet[];

  // This adds new imports to our module, as if they were really there. Helpful
  // for working around addons that depend on things but don't say so.
  dependsOnModules?: string[];
}

// The bare "string" short form implies that `becomes` is the same as `name`.
export type ArgumentMapping =
  | string
  | {
      // the name of the argument you accept
      name: string;
      // the name its consumed as in your template
      becomes: string;
    };

// A component snippet is a string containing valid HBS that is a single
// component invocation. We use it to refer to components in a way that doesn't
// require any new syntax or rules, and that's necessarily supported by whatever
// build-time template resolver is in use.
//
// Examples of valid ComponentSnippets:
//
//    "{{my-component}}"
//    "{{my-component/foo}}"
//    "<MyComponent />"
//    "{{component 'my-component'}}"
//
type ComponentSnippet = string;

export interface PreprocessedComponentRule {
  yieldsSafeComponents: Required<ComponentRules>['yieldsSafeComponents'];
  yieldsArguments: Required<ComponentRules>['yieldsArguments'];
  argumentsAreComponents: string[];
  safeToIgnore: boolean;
  safeInteriorPaths: string[];
  disambiguate: Record<string, 'component' | 'helper' | 'data'>;
}

// take a component rule from the authoring format to a format more optimized
// for consumption in the resolver
export function preprocessComponentRule(componentRules: ComponentRules): PreprocessedComponentRule {
  let argumentsAreComponents = [];
  let safeInteriorPaths = [];
  if (componentRules.acceptsComponentArguments) {
    for (let entry of componentRules.acceptsComponentArguments) {
      let name, interior;
      if (typeof entry === 'string') {
        name = interior = entry;
      } else {
        name = entry.name;
        interior = entry.becomes;
      }
      if (name.startsWith('@')) {
        name = name.slice(1);
      }
      argumentsAreComponents.push(name);
      safeInteriorPaths.push(interior);
      safeInteriorPaths.push('this.' + interior);
      safeInteriorPaths.push('@' + name);
    }
  }
  if (componentRules.invokes) {
    for (let [path] of Object.entries(componentRules.invokes)) {
      safeInteriorPaths.push(path);
    }
  }
  return {
    safeInteriorPaths,
    safeToIgnore: Boolean(componentRules.safeToIgnore),
    argumentsAreComponents,
    yieldsSafeComponents: componentRules.yieldsSafeComponents || [],
    yieldsArguments: componentRules.yieldsArguments || [],
    disambiguate: componentRules?.disambiguate ?? {},
  };
}

export function activePackageRules(
  packageRules: PackageRules[],
  activePackages: { name: string; root: string; version: string }[]
): ActivePackageRules[] {
  // rule order implies precedence. The first rule that matches a given package
  // applies to that package, and no other rule does.
  let rootsPerRule = new Map();
  for (let pkg of activePackages) {
    for (let rule of packageRules) {
      if (rule.package === pkg.name && (!rule.semverRange || satisfies(pkg.version, rule.semverRange))) {
        let roots = getOrCreate(rootsPerRule, rule, () => []);
        roots.push(pkg.root);
        break;
      }
    }
  }
  let output = [];
  for (let [rule, roots] of rootsPerRule) {
    output.push(Object.assign({ roots }, rule));
  }
  return output;
}

export function appTreeRulesDir(root: string, resolver: Resolver) {
  let pkg = resolver.packageCache.ownerOfFile(root);
  if (pkg) {
    let matched = resolveExports(pkg.packageJSON, './index.js');
    if (matched) {
      return dirname(pathResolve(root, matched[0]));
    }
  }
  return root;
}
