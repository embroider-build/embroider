#!/usr/bin/env node
import { type Options, run } from './index.js';

import { program } from '@commander-js/extra-typings';

program.name('template-tag-codemod').description(`Converts Ember's .hbs format to .gjs or .gts format.`);

program
  .command('convert', { isDefault: true })
  .option(
    '--no-relativeLocalPaths',
    `When true, imports for other files in the same project will use relative paths with file extensions. This is the most compatible with modern Node ESM convensions, but it's not supported by Ember's classic build.`
  )
  .option(
    '--extensions <...extensions>',
    `File extensions to search when resolving components, helpers, and modifiers inside your hbs files`
  )
  .option(
    '--no-nativeRouteTemplates',
    `When true, assume we can use template-tag directly in route files (requires ember-source >= 6.3.0-beta.3). When false, assume we can use the ember-route-template addon instead.`
  )
  .option(
    '--no-nativeLexicalThis',
    `When true, assume that Ember supports accessing the lexically-scoped "this" from template-tags that are used as expressions (requires ember-source >= TODO). When false, introduce a new local variable to make "this" accessible.`
  )
  .option(
    '--routeTemplates [globs...]',
    `Controls which route template files we will convert to template tag. Provide a list of globs.`
  )
  .option(
    '--components [globs...]',
    `Controls which component files we will convert to template tag. Provide a list of globs.`
  )
  .option(
    '--renderTests [globs...]',
    `Controls the files in which we will search for rendering tests to convert to template tags. Provide a list of globs.`
  )
  .option(
    '--defaultFormat <value>',
    `When a .js or .ts file already exists, we necessarily convert to .gjs or .gts respectively. But when only an .hbs file exists, we have a choice of default.`
  )
  .option(
    '--templateOnlyComponentSignature <value>',
    `Snippet of typescript to use as the type signature of newly-converted template-only components.`
  )
  .option('--routeTemplateSignature <value>', `Snippet of typescript to use as the type signature of route templates.`)
  .option(
    '--templateInsertion <value>',
    `Where should <template> be inserted inside existing class bodies? Say "beginning" or "end".`
  )
  .option(
    '--renamingRules <value>',
    `The name of a module that will provide a renaming strategy for picking the names of components, helpers, and modifiers in rewritten templates`
  )
  .option(
    '--reusePrebuild',
    `Allows you to reuse prebuild between runs of this codemod. While this speeds things up it is not what most people should be doing, use with caution.`
  )
  .option(
    '--addNameToTemplateOnly',
    `Exports template-only components via a named const definition. This can improve import autocompletion in IDEs.`
  )
  .action(async args => {
    await run(args as Options);
    // we need this to be explicit because our prebuild runs things like
    // broccoli-babel-transpiler which leak worker processes and will
    // otherwise prevent exit.🤮
    process.exit(0);
  });

function parseBoolean(): boolean {
  return true;
}

program
  .command('merge-history')
  .description('Merge the histories of your hbs and js files into your new gjs files')

  .argument('<beforeCommit>', 'A git commit-ish identifying the commit before you ran the template-tag-codemod')
  .argument('<afterCommit>', `A git commit-ish identifying the commit after you ran the template-tag-codemod`)
  .option(
    '--outputBranch <value>',
    'The name of the branch this command will create for you, containing the merged history from "beforeCommit" and "afterCommmit"',
    'template-tag-codemod'
  )
  .option('--allowOverwrite <value>', 'Destructively replace the existing outputBranch', parseBoolean, false)
  .action(async (beforeCommit, afterCommit, args) => {
    let { mergeHistory } = await import('./merge-history.js');
    await mergeHistory({ beforeCommit, afterCommit, ...args });
  });

program.parse();
