/**
 * Most of this code was taken from https://github.com/discourse/discourse/blob/7f591bc7c590eb4f9f970a5deb33a25bfee3575a/frontend/discourse/lib/maybe-babel.mjs
 * and previous iterations of the same code. This is currently provided as an experiment for people to try out and report back their findings
 */
import { parse as oxcParse } from 'oxc-parser';
import { walk } from 'zimmerframe';
import { and, code, id, include, not, or } from '@rolldown/pluginutils';
import { extensions } from './ember.js';

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

export async function oxcFilter(id: string, code: string) {
  const estree = await oxcParse(id, code);

  let hasDecorators = false;
  let hasBabelRequiredImport = false;

  walk(
    estree.program,
    /* state */ {},
    {
      // @ts-expect-error
      Decorator(_node: unknown, { stop }: { stop: () => void }) {
        hasDecorators = true;
        stop();
      },
      ImportDeclaration(node: any, { stop }: { stop: () => void }) {
        if (babelRequiredImports.includes(node.source.value)) {
          hasBabelRequiredImport = true;
          stop();
        }
      },
    }
  );

  return hasDecorators || hasBabelRequiredImport;
}

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

const regExpCharactersRegExp = /[\\^$.*+?()[\]{}|]/g;
const escapeRegExpCharacters = (str: string) => str.replace(regExpCharactersRegExp, '\\$&');

const extensionRegExp = new RegExp(
  `(${extensions
    .filter(ext => ext !== '.json')
    .map(escapeRegExpCharacters)
    .join('|')})(\\?.*)?(#.*)?$`
);

type Options = {
  include?: {
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
    imports?: string[];
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
    code?: (string | RegExp)[];
  };
};

export function regexFitler(options?: Options) {

  const importsRegex = new RegExp(
    babelRequiredImports
      .concat(options?.include?.imports ?? [])
      .map(escapeRegExp)
      .join('|')
  );

  return [
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
          ...(options?.include?.code?.map(x => code(x)) ?? [])
        )
      )
    ),
  ];
}

