---
"@embroider/addon-dev": patch
---

Fix an issue with `@embroider/addon-dev`'s `keepAssets` rollup plugin where the filesystem was hit for every possible file (including non-existing ones) when trying to determine if an import matched the provided globs.

This potentially speeds rollup builds by 3x, depending on other plugins present in the rollup config.
