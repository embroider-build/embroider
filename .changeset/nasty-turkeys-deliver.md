---
'@embroider/compat': major
'@embroider/core': major
'@embroider/webpack': major
---

- BREAKING: Drop support for Ember < 3.28 [1246](https://github.com/embroider-build/embroider/pull/1246)

  This allows us to rely on:

  - first-class components, helpers, and modifiers
  - template lexical scope
  - the lack of the old modules-api-polyfill

    which greatly simplifies the build.

- ENHANCEMENT: Simplified template compilation pipeline [1242](https://github.com/embroider-build/embroider/pull/1242), [1276](https://github.com/embroider-build/embroider/pull/1276)

  Uses babel-plugin-ember-template-compilation 2.0, which [offers new capabilities to AST transform authors](https://github.com/emberjs/babel-plugin-ember-template-compilation#jsutils-manipulating-javascript-from-within-ast-transforms) that better unlock the power of strict mode templates.

- ENHANCEMENT: For most invocations of components, helpers, and modifiers when `staticComponents`, `staticHelpers`, and `staticModifiers` settings are enabled, we now entirely bypass the AMD loader using template lexical scope. This results in less work at runtime and slightly smaller code.

- BREAKING: The above feature won't have any breaking effects in the vast majority of apps that are doing things correctly. But I'm calling this out as potentially breaking because you may be accidentally relying on the loose old behaviors:

  1.  Using a component in one place would cause it to become globally available to the AMD loader after that point. This would let string-based component resolution work when it actually shouldn't have (if you are resolving strings into components at runtime, you can't use `staticComponents` mode).

  2.  If you have multiple copies of an addon, which copy would get invokved from a given template was hard to predict before, now each one will definitely see it's own dependency.
