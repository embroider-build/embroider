---
'@embroider/util': minor
---

Improve types of `ensure-safe-component` helper

This will improve the Glint type of `ensure-safe-component` in two ways:

- when a component class is passed, the return type will _not_ get narrowed down to an (mostly unusable) `ComponentLike<unknown>`, but to the type of the passed component itself
- when a string is passed that has an entry in the `@glint/environment-ember-loose` template registry, then the registered type will be returned instead of again `ComponentLike<unknown>`
