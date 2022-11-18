---
'@embroider/addon-dev': major
---

BREAKING: `@embroider/addon-template/template-transform-plugin` is removed
because `babel-plugin-ember-template-compilation >= 2.0.0` now directly supports
source-to-source transformation.

This plugin was used to run any custom AST transformations on your templates before publishing. To replace it:

1. Add `babel-plugin-ember-template-compilation@^2.0.0` as a devDependency.
2. Make sure you also have a devDependency on `ember-source`, so we have a template compiler.
3. Update the babel config like:

   ```diff
   plugins: [
   -   [
   -     '@embroider/addon-dev/template-transform-plugin',
   -     {
   -       astTransforms: [
   -         ...yourPluginsHere
   -       ]
   -     }
   -   ],
   +   [
   +     'babel-plugin-ember-template-compilation',
   +     {
   +       compilerPath: 'ember-source/dist/ember-template-compiler',
   +       targetFormat: 'hbs',
   +       transforms: [
   +         ...yourPluginsHere
   +        ]
   +     }
   +   ]
   ]
   ```

See https://github.com/emberjs/babel-plugin-ember-template-compilation for the complete docs on these options.
