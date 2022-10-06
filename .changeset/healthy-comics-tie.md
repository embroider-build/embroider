---
'@embroider/addon-dev': major
---

[#1223][pr-1223] Extensions in addon-dev's rollup plugin are now all normalized to .js.

Previously, when addonEntrypoints would include `.{js,ts}`, these entries should no only say .js.
All files are in terms of "the outputs", which are JavaScript.

Also in #1223, this PR fixes an issue where components authored in typescript could not be used

[pr-1223]: https://github.com/embroider-build/embroider/pull/1223
