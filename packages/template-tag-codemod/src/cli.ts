#!/usr/bin/env node
import { type Options, optionsWithDefaults, run } from './index.js';

import { program } from '@commander-js/extra-typings';

program
  .name('template-tag-codemod')
  .description(`Converts Ember's .hbs format to .gjs or .gts format.`)
  .option(
    '--no-relativeLocalPaths',
    `When true, imports for other files in the same project will use relative paths with file extensions. This is the most compatible with modern Node ESM convensions, but it's not supported by Ember's classic build.`,
    optionsWithDefaults().relativeLocalPaths
  )
  .option(
    '--extensions <...extensions>',
    `File extensions to search when resolving components, helpers, and modifiers inside your hbs files`,
    optionsWithDefaults().extensions
  )
  .option(
    '--no-nativeRouteTemplates',
    `When true, assume we can use template-tag directly in route files (requires ember-source >= 6.3.0-beta.3). When false, assume we can use the ember-route-template addon instead.`,
    optionsWithDefaults().nativeRouteTemplates
  )
  .option(
    '--nativeLexicalThis',
    `When true, assume that Ember supports accessing the lexically-scoped "this" from template-tags that are used as expressions (requires ember-source >= TODO). When false, introduce a new local variable to make "this" accessible.`,
    optionsWithDefaults().nativeLexicalThis
  )
  .option(
    '--routeTemplates <...globs>',
    `Controls which route template files we will convert to template tag. Provide a list of globs.`,
    optionsWithDefaults().routeTemplates
  )
  .option(
    '--components <...globs>',
    `Controls which component files we will convert to template tag. Provide a list of globs.`,
    optionsWithDefaults().components
  )
  .option(
    '--renderTests <...globs>',
    `Controls the files in which we will search for rendering tests to convert to template tags. Provide a list of globs.`,
    optionsWithDefaults().renderTests
  )
  .option(
    '--defaultFormat <value>',
    `When a .js or .ts file already exists, we necessarily convert to .gjs or .gts respectively. But when only an .hbs file exists, we have a choice of default.`,
    optionsWithDefaults().defaultFormat
  )
  .option(
    '--templateOnlyComponentSignature <value>',
    `Snippet of typescript to use as the type signature of newly-converted template-only components.`,
    optionsWithDefaults().templateOnlyComponentSignature
  )
  .option(
    '--routeTemplateSignature <value>',
    `Snippet of typescript to use as the type signature of route templates.`,
    optionsWithDefaults().routeTemplateSignature
  )
  .option(
    '--templateInsertion <value>',
    `Where should <template> be inserted inside existing class bodies? Say "beginning" or "end".`,
    optionsWithDefaults().templateInsertion
  )
  .option(
    '--renamingRules <value>',
    `The name of a module that will provide a renaming strategy for picking the names of components, helpers, and modifiers in rewritten templates`,
    optionsWithDefaults().renamingRules
  )
  .action(async args => {
    await run(args as Options);

    // we need this to be explicit because our prebuild runs things like
    // broccoli-babel-transpiler which leak worker processes and will
    // otherwise prevent exit.🤮
    process.exit(0);
  });

program.parse();
