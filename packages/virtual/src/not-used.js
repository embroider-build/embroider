/**
 * This file exists to appease both type checking and require.resolve
 * checks for the existance of `@embroider/virtual`.
 *
 * This library has a '.' entrypoint which points to this file for require.resolve (if a consumer needed), as well as every other export.
 *
 * Real types are provided for the non-'.' exports.
 */

throw new Error(
  `@embroider/virtual module loaded at runtime! This is likely a mistake. Make sure that you have all the needed plugins for virtually providing embroider's virtual modules.`
);
