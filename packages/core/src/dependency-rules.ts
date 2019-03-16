
// A component snippet is a string containing valid HBS that is a singlie
// component invocation. We use it to refer to compnents in a way that doesn't
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

export interface OwnPackageRules {
  modules?: {
    // `filename` is relative to your package root, and it assumes v2 package
    // format. Like "./templates/components/foo.hbs".
    [filename: string]: ModuleRules;
  };

  // An unresolvable component is usually build error (when your app has the
  // staticComponent Option enabled). But you can tell Embroider to ignore them
  // by putting them into here. This is useful when you know the component won't
  // really be invoked (it's inside a conditional branch you know you'll never
  // go down).
  optionalComponents?: ComponentSnippet[];
}

export interface PackageRules extends OwnPackageRules {
  name: string;
  semverRange?: string;
}

export interface ModuleRules {
  // These are template snippets, like:
  //    "{{my-component}}"
  //    "<MyComponent />"
    // so we can support exactly the same range of syntaxes that templates do.
  dependsOnComponents?: string[];

  // These are the same as the string literal you pass to `import "some-thing"`
  dependsOnModules?: string[];

  // This lets you "pass the buck" when you have a dynamic component invocation.
  dynamicComponents?: {
    // `name` is the name that's being used in the template as a dynamic
    // component, so for:
    //
    //    {{component trigger}}
    //
    // name would be "trigger".
    //
    // fromComponent is a template snippet, the same as described above for
    // `dependsOnComponents`.
    //
    // argument specifies which argument into the `fromComponent` is the source
    // of this dynamic component value. By default we assume it's equal to
    // `name`.
    [name: string]: { fromComponent: string, argument?: string }
  };
}
