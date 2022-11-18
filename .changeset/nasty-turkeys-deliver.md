---
'@embroider/compat': major
'@embroider/core': major
'@embroider/webpack': major
---

Drop support for Ember < 3.28

This allows us to rely on:

- first-class components, helpers, and modifiers
- template lexical scope
- the lack of the old modules-api-polyfill

  which greatly simplifies the build.
