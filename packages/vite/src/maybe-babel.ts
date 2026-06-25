/**
 * Most of this code was taken from https://github.com/discourse/discourse/blob/7f591bc7c590eb4f9f970a5deb33a25bfee3575a/frontend/discourse/lib/maybe-babel.mjs
 * and previous iterations of the same code. This is currently provided as an experiment for people to try out and report back their findings
 */

import { parse as oxcParse } from 'oxc-parser';
import { walk } from 'zimmerframe';
import { extensions } from './ember.js';
import { and, code, id, include, not, or } from '@rolldown/pluginutils';

const babelRequiredImports = [
  // Templates
  '@ember/template-compiler',
  '@ember/template-compilation',
  'ember-cli-htmlbars',
  'ember-cli-htmlbars-inline-precompile',
  'htmlbars-inline-precompile',

  // Macros
  '@embroider/macros',
  '@glimmer/env',
  '@ember/debug',
  '@ember/application/deprecations',
];

export async function maybeBabelFilter(id: string, code: string) {
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

const importsRegex = new RegExp(babelRequiredImports.map(escapeRegExp).join('|'));

const decoratorRegex = /(?<![\w'"`])(?<!\*\s)(?<!\/\/[^\n]*)@\w+/;
//                      └────┬─────┘└───┬───┘└──────┬──────┘└┬─┘
//                           │          │           │         │
//                           │          │           │         └── the `@decorator`
//                           │          │           └── not on a `//` line comment
//                           │          └── not a JSDoc tag (`* @param`)
//                           └── not mid-identifier or inside a string

const nodeModulesPattern = /\/node_modules\//;

const regExpCharactersRegExp = /[\\^$.*+?()[\]{}|]/g;
const escapeRegExpCharacters = (str: string) => str.replace(regExpCharactersRegExp, '\\$&');

const extensionRegExp = new RegExp(
  `(${extensions
    .filter(ext => ext !== '.json')
    .map(escapeRegExpCharacters)
    .join('|')})(\\?.*)?(#.*)?$`
);

export const maybeBabelRegexFilter = [
  include(
    and(
      id(extensionRegExp), // Is one of the babel-supported extensions
      or(
        code(importsRegex), // Imports one of our listed modules
        and(not(id(nodeModulesPattern)), code(decoratorRegex)) // Is local app code which uses a decorator
      )
    )
  ),
];
