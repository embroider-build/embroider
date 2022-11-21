---
'@embroider/test-setup': minor
---

`@embroider/test-setup` only installs the dependencies that match the version that `@embroider/test-setup` is set to.
The Changesets release tool has a feature to link packages togother such that they all share the same version.
Documentation on that is here: https://github.com/changesets/changesets/blob/main/docs/config-file-options.md#linked-array-of-arrays-of-package-names

The packages that, with the currenty implementation of `@embroider/test-setup`, must always be linked are:

- `@embroider/compat`
- `@embroider/core`
- `@embroider/webpack`
- `@embroider/test-setup`
