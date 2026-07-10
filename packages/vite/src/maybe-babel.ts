import { babel } from '@rollup/plugin-babel';
import type { RollupBabelInputPluginOptions } from '@rollup/plugin-babel';
import { and, code, id, include, not, or } from '@rolldown/pluginutils';
import type { Plugin } from 'vite';

import { extensions } from './ember.js';

/**
 * If a file imports any of these, it needs babel (templates, macros, and a
 * couple of addons that ship decorator-adjacent runtime code).
 */
const babelRequiredImports = [
  // Templates
  // (old non template() form)
  '@ember/template-compiler',
  '@ember/template-compilation',

  // Legacy templates (hbs / loose mode)
  'ember-cli-htmlbars',
  'ember-cli-htmlbars-inline-precompile',
  'htmlbars-inline-precompile',

  // Build Macros
  // (since import.meta.env is not available in all environments)
  '@embroider/macros',
  '@glimmer/env',
  '@ember/debug',
  '@ember/application/deprecations',
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const decoratorRegex = /(?<![\w'"`])(?<!\*\s+)(?<!\/\/[^\n]*)(?<!\/\*[^\n]*)@\w+/;
//                     └────┬─────┘└───┬───┘└──────┬──────┘└──────┬──────┘└┬─┘
//                          │          │           │              │        │
//                          │          │           │              │        └── the `@decorator`
//                          │          │           │              └──────── not inside a single-line block comment (`/* @dec */`)
//                          │          │           └─────────────────────── not on a `//` line comment
//                          │          └─────────────────────────────────── not a JSDoc tag, even with multiple spaces (`*    @param`)
//                          └────────────────────────────────────────────── not mid-identifier or inside a string

const nodeModulesPattern = /\/node_modules\//;

function escapeRegExpCharacters(str: string) {
  return str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

const extensionRegExp = new RegExp(
  `(${extensions
    .filter(ext => ext !== '.json')
    .map(escapeRegExpCharacters)
    .join('|')})(\\?.*)?(#.*)?$`
);

type Options = Omit<RollupBabelInputPluginOptions, 'filter'> & {
  filter?: {
    include: {
      /**
       * If any additional (custom) plugins are provided, a pattern
       * should be provided that detects their usage
       *
       * for example, to also run babel on files that import from ember-concurrency
       * ```js
       * {
       *   code: ['ember-concurrency'],
       * }
       * ```
       */
      imports: string[];
      /**
       * If any additional (custom) plugins are provided, a pattern
       * should be provided that detects their usage
       *
       * for example, to also run babel on files that use polyfilled APIs,
       * or use the "formatMessage" technique for translations
       * ```js
       * {
       *   code: ['myPolyfilledAPICall(', /\bintl\.formatMessage\b/],
       * }
       * ```
       */
      code: (string | RegExp)[];
    };
  };
};

export function maybeBabel(userOptions: Options = {}): Plugin {
  const { filter, ...options } = userOptions;

  const plugin = babel({
    babelHelpers: 'runtime',
    extensions,
    skipPreflightCheck: true,
    ...options,
  });

  const importsRegex = new RegExp(
    babelRequiredImports
      .concat(filter?.include?.imports ?? [])
      .map(escapeRegExp)
      .join('|')
  );

  const maybeBabelFilter = [
    include(
      and(
        // is one of the babel-supported extensions
        id(extensionRegExp),
        or(
          // always run gts and gjs through babel
          id(/\.gts$/),
          id(/\.gjs$/),
          // imports one of the modules above
          code(importsRegex),
          // (a common way to do translations)
          // local app code using a decorator
          // NOTE: maybeBabel requires that all libraries compile away their decorators
          //
          // TODO: what do we do when native decorators start shipping?
          //     (ignore decorator transforming entirely?)
          and(not(id(nodeModulesPattern)), code(decoratorRegex)),
          // user provided additional opt-ins to the regex here
          ...(filter?.include?.code?.map(x => code(x)) ?? [])
        )
      )
    ),
  ];

  // types are incorrect
  (plugin.transform as { filter: unknown }).filter = maybeBabelFilter;

  return {
    ...plugin,
    enforce: 'pre',
    name: 'embroider:maybe-babel',
  } as Plugin;
}
