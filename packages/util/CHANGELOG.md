# @embroider/util

## 1.11.0

### Minor Changes

[#1354](https://github.com/embroider-build/embroider/pull/1354) : Add glint helper types for more macros : _by [@vlascik](https://github.com/vlascik)_
Improve types of `ensure-safe-component` helper

This will improve the Glint type of `ensure-safe-component` in two ways:

- when a component class is passed, the return type will _not_ get narrowed down to an (mostly unusable) `ComponentLike<unknown>`, but to the type of the passed component itself
- when a string is passed that has an entry in the `@glint/environment-ember-loose` template registry, then the registered type will be returned instead of again `ComponentLike<unknown>`

### Patch Changes

[#1388](https://github.com/embroider-build/embroider/pull/1388) : Enable prettier in ci : _by [@NullVoxPopuli](https://github.com/NullVoxPopuli)_

- Updated dependencies
  - @embroider/macros@1.11.0
