#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { type Options, optionsWithDefaults, run } from './index.js';
import type { MergeHistoryOptions } from './merge-history.js';

yargs(process.argv.slice(2))
  .scriptName('template-tag-codemod')
  .command(
    '$0',
    "Converts Ember's .hbs format to .gjs or .gts format.",
    y =>
      y
        .option('relativeLocalPaths', {
          default: optionsWithDefaults().relativeLocalPaths,
          type: 'boolean',
          describe: `When true, imports for other files in the same project will use relative paths with file extensions. This is the most compatible with modern Node ESM convensions, but it's not supported by Ember's classic build.`,
        })
        .option('extensions', {
          array: true,
          type: 'string',
          default: optionsWithDefaults().extensions,
          describe: `File extensions to search when resolving components, helpers, and modifiers inside your hbs files`,
        })
        .option('nativeRouteTemplates', {
          default: optionsWithDefaults().nativeRouteTemplates,
          type: 'boolean',
          describe: `When true, assume we can use template-tag directly in route files (requires ember-source >= 6.3.0-beta.3). When false, assume we can use the ember-route-template addon instead.`,
        })
        .option('nativeLexicalThis', {
          default: optionsWithDefaults().nativeLexicalThis,
          type: 'boolean',
          describe: `When true, assume that Ember supports accessing the lexically-scoped "this" from template-tags that are used as expressions (requires ember-source >= TODO). When false, introduce a new local variable to make "this" accessible.`,
        })
        .option('routeTemplates', {
          array: true,
          type: 'string',
          default: optionsWithDefaults().routeTemplates,
          describe: `Controls which route template files we will convert to template tag. Provide a list of globs.`,
        })
        .option('components', {
          array: true,
          type: 'string',
          default: optionsWithDefaults().components,
          describe: `Controls which component files we will convert to template tag. Provide a list of globs.`,
        })
        .option('renderTests', {
          array: true,
          type: 'string',
          default: optionsWithDefaults().renderTests,
          describe: `Controls the files in which we will search for rendering tests to convert to template tags. Provide a list of globs.`,
        })
        .option('defaultFormat', {
          type: 'string',
          default: optionsWithDefaults().defaultFormat,
          describe: `When a .js or .ts file already exists, we necessarily convert to .gjs or .gts respectively. But when only an .hbs file exists, we have a choice of default.`,
        })
        .option('templateOnlyComponentSignature', {
          type: 'string',
          default: optionsWithDefaults().templateOnlyComponentSignature,
          describe: `Snippet of typescript to use as the type signature of newly-converted template-only components.`,
        })
        .option('routeTemplateSignature', {
          type: 'string',
          default: optionsWithDefaults().routeTemplateSignature,
          describe: `Snippet of typescript to use as the type signature of route templates.`,
        })
        .option('templateInsertion', {
          type: 'string',
          default: optionsWithDefaults().templateInsertion,
          describe: `Where should <template> be inserted inside existing class bodies? Say "beginning" or "end".`,
        })
        .option('renamingRules', {
          type: 'string',
          default: optionsWithDefaults().renamingRules,
          describe: `The name of a module that will provide a renaming strategy for picking the names of components, helpers, and modifiers in rewritten templates`,
        })
        .option('reusePrebuild', {
          type: 'boolean',
          default: optionsWithDefaults().reusePrebuild,
          describe: `Allows you to reuse prebuild between runs of this codemod. While this speeds things up it is not what most people should be doing, use with caution.`,
        })
        .option('addNameToTemplateOnly', {
          type: 'boolean',
          default: optionsWithDefaults().addNameToTemplateOnly,
          describe: `Exports template-only components via a named const definition. This can improve import autocompletion in IDEs.`,
        }),

    async argv => {
      await run(argv as Options);

      // we need this to be explicit because our prebuild runs things like
      // broccoli-babel-transpiler which leak worker processes and will
      // otherwise prevent exit.🤮
      process.exit(0);
    }
  )
  .command(
    'merge-history <beforeCommit> <afterCommit>',
    'Merge the histories of your hbs and js files into your new gjs files',
    y =>
      y
        .positional('beforeCommit', {
          type: 'string',
          description: 'A git commit-ish identifying the commit before you ran the template-tag-codemod',
        })
        .positional('afterCommit', {
          type: 'string',
          description: `A git commit-ish identifying the commit after you ran the template-tag-codemod`,
        })
        .option('outputBranch', {
          type: 'string',
          default: 'template-tag-codemod',
          description:
            'The name of the branch this command will create for you, containing the merged history from "beforeCommit" and "afterCommmit"',
        })
        .option('allowOverwrite', {
          type: 'boolean',
          default: false,
          description: 'Destructively replace the existing outputBranch',
        }),

    async argv => {
      let { mergeHistory } = await import('./merge-history.js');
      await mergeHistory(argv as MergeHistoryOptions);
    }
  )
  .strict()
  .parse();
