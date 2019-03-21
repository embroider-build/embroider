import { Package } from '@embroider/core';
import { satisfies } from 'semver';
import CompatResolver from './resolver';

export interface PackageRules {
  // This whole set of rules will only apply when the given addon package
  // matching the given semver range is present and active.
  package: string;
  semverRange?: string;

  components: {
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
}

export interface ActivePackageRules extends PackageRules {
  // the location(s) of active packages that match this rule.
  roots: string[];
}

export interface ComponentRules {
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
// component invocation. We use it to refer to compoanents in a way that doesn't
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
  argumentsAreComponents: string[];
  safeInteriorPaths: string[];
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
    }
  }
  return {
    argumentsAreComponents,
    safeInteriorPaths,
    yieldsSafeComponents: componentRules.yieldsSafeComponents || [],
  };
}

export function activePackageRules(packageRules: PackageRules[], activePackages: Package[]): ActivePackageRules[] {
  // rule order implies precedence. The first rule that matches a given package
  // applies to that package, and no other rule does.
  let rootsPerRule = new Map();
  for (let pkg of activePackages) {
    for (let rule of packageRules) {
      if (rule.package === pkg.name && (!rule.semverRange || satisfies(pkg.version, rule.semverRange))) {
        let roots = rootsPerRule.get(rule);
        if (roots) {
          roots.push(pkg.root);
        } else {
          rootsPerRule.set(rule, [pkg.root]);
        }
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

export function expandModuleRules(absPath: string, moduleRules: ModuleRules, resolver: CompatResolver) {
  let output: { absPath: string; target: string; runtimeName?: string }[] = [];
  if (moduleRules.dependsOnModules) {
    for (let target of moduleRules.dependsOnModules) {
      output.push({ absPath, target });
    }
  }
  if (moduleRules.dependsOnComponents) {
    for (let snippet of moduleRules.dependsOnComponents) {
      let found = resolver.resolveComponentSnippet(snippet, moduleRules);
      for (let { absPath: target, runtimeName } of found.modules) {
        output.push({ absPath, target, runtimeName });
      }
    }
  }
  return output;
}
