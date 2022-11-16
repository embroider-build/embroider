---
'@embroider/addon-dev': patch
'@embroider/addon-shim': patch
'@embroider/compat': patch
'@embroider/router': patch
'@embroider/shared-internals': patch
'@embroider/test-setup': patch
'@embroider/test-support': patch
'@embroider/test-scenarios': patch
---

By updating internal lint configs and using eslint-plugin-n,
it was revaled that a number of packages were missing dependency declarations.
Packages imported must be declared in package.json.
