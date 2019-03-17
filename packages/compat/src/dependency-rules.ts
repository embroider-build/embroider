// A component snippet is a string containing valid HBS that is a single
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

export interface PackageRules {
  package: string;
  semverRange?: string;
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
  optionalComponents?: string[];
}

export interface ModuleRules {
  // We will resolve these components into the corresponding JS and HBS files
  // and generate imports such that this module depends on them.
  dependsOnComponents?: ComponentSnippet[];

  // These are the same as the string literal you pass to `import "some-thing"`
  dependsOnModules?: string[];

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
  yieldsSafeComponents?: (boolean | { [name: string]: boolean } )[];

  // This lets you tell us where a particular dynamic component definition is
  // coming from so we can trace it.
  dynamicComponentSources?: {
    // an identifier in your template that gets passed to the {{component}}
    // helper. For example, if you template says `{{component trigger}}`, you
    // should use the name "trigger" here.
    [name: string]: {
      // this tells us that `name` comes from one of the component's arguments.
      // Which implies that we will tolerate the {{component}} helper using
      // `name`, but we will move our checking to the callsites of this component
      // to make sure people passing this argument are passing
      // statically-analyzable component values (including string literals, which
      // we can safely identify and turn into component imports).
      fromArgument?: string;

      // this tells embroider to just ignore this name, you're promising that
      // you've already ensured whatever component it represents is present.
      ignore?: true;
    }
  };
}
