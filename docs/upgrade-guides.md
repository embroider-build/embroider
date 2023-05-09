# @embroider/core 2.x -> 3.x

## Breaking changes and how to resolve them

1. `unsupported ambiguous syntax`: When using `staticComponents` or `staticHelpers`, we no longer tolerate forms that are ambiguous between components, helpers, and this-property-fallback. For example, if
     ```hbs
     {{thing}}
     ```

     appears by itself in a (non-strict) template, it could mean:
      - a component invocation: `<Thing />`
      - a helper invocation: `{{ (thing) }}`
      - property-this-fallback: `{{this.thing}}`
      
    The benefit of this change is that we can get rid of a lot of gnarly compatbility code that reduced build performance and introduced subtle caveats. 

    Ember itself no longer supports property-this-fallback as of 4.0. And the Ember default blueprint has shipped with a default lint rule for multiple years that tells you not to use `{{thing}}`, in favor of angle bracket invocation or explicit `{{this.thing}}`.

    If you're hitting this problem in your own code, change the ambiguous form to one of the three above unambiguous forms: a component with angle brackets, a helper with parentheses, or an explicit `this.` property.

    If you're hitting this problem in third-party code that you don't want to patch, you can use a packageRule to tell Embroider how to disambiguate the case:

    ```js
    // ember-cli-build.js
    compatBuild(app, Webpack, {
      packageRules: [
        {
          package: 'some-addon',
          semverRange: '<= 5.0',
          addonTemplates: {
            'templates/components/some-component.hbs': {
              disambiguate: {
                // or "helper" or "data"
                'thing': 'component', 
              },
            },
          }
        }
      ]
    })
    ```

2. `unsupported ambiguity between helper and component`: If you have forms that are ambiguous between being a helper and being a component, your settings for `staticComponents` and `staticHelpers` must now agree.

    For example, `{{some-thing value=1}}` could be a component or a helper. If you have code like this, Embroider options like `{ staticHelpers: true, staticComponents: false }` are no longer allowed. They need to both be true or both be false.

    You can fix this problem by either changing the forms to be unambiguous (in the same way as described in the previous section), or by changing one of the `staticCompnents` or `staticHelpers` flags to match the other one.


3. The `safeToIgnore` packageRule used to only suppress an error when a component was not found. Now it prevents us from even trying to resolve the component.

4. We no longer include a workaround for https://github.com/emberjs/ember.js/issues/19877, because Ember backported fixes to every major version that we support. Make sure you're on a supported Ember patch release. The oldest patch we support is ember-source 3.28.11.

    This particular bug is important to us because whenever `staticHelpers` is enabled, we convert all helper invocations to lexically scoped helper invocations. So if you have any class-based helpers and you have `staticHelpers` enabled you definitely need the Ember bugfix.






