import { NodePath } from '@babel/traverse';
import { transform, types as t } from '@babel/core';

function parseVersion(templateCompilerPath: string, source: string): { major: number; minor: number; patch: number } {
  // ember-template-compiler.js contains a comment that indicates what version it is for
  // that looks like:

  /*!
   * @overview  Ember - JavaScript Application Framework
   * @copyright Copyright 2011-2020 Tilde Inc. and contributors
   *            Portions Copyright 2006-2011 Strobe Inc.
   *            Portions Copyright 2008-2011 Apple Inc. All rights reserved.
   * @license   Licensed under MIT license
   *            See https://raw.github.com/emberjs/ember.js/master/LICENSE
   * @version   3.25.1
   */

  let version = source.match(/@version\s+([\d\.]+)/);
  if (!version || !version[1]) {
    throw new Error(
      `Could not find version string in \`${templateCompilerPath}\`. Maybe we don't support your ember-source version?`
    );
  }

  let numbers = version[1].split('.');
  let major = parseInt(numbers[0], 10);
  let minor = parseInt(numbers[1], 10);
  let patch = parseInt(numbers[2], 10);

  return { major, minor, patch };
}

function emberVersionGte(templateCompilerPath: string, source: string, major: number, minor: number): boolean {
  let actual = parseVersion(templateCompilerPath, source);

  return actual.major > major || (actual.major === major && actual.minor >= minor);
}

export function patch(source: string, templateCompilerPath: string): string {
  let version = parseVersion(templateCompilerPath, source);

  if (
    emberVersionGte(templateCompilerPath, source, 3, 26) ||
    (version.major === 3 && version.minor === 25 && version.patch >= 2) ||
    (version.major === 3 && version.minor === 24 && version.patch >= 3)
  ) {
    // no modifications are needed after
    // https://github.com/emberjs/ember.js/pull/19426 and backported to
    // 3.26.0-beta.3, 3.25.2, 3.24.3
    return source;
  }

  let replacedVar = false;
  let patchedSource;

  let needsAngleBracketPrinterFix =
    emberVersionGte(templateCompilerPath, source, 3, 12) && !emberVersionGte(templateCompilerPath, source, 3, 17);

  if (needsAngleBracketPrinterFix) {
    // here we are stripping off the first `var Ember;`. That one small change
    // lets us crack open the file and get access to its internal loader, because
    // we can give it our own predefined `Ember` variable instead, which it will
    // use and put `Ember.__loader` onto.
    //
    // on ember 3.12 through 3.16 (which use variants of glimmer-vm 0.38.5) we
    // also apply a patch to the printer in @glimmer/syntax to fix
    // https://github.com/glimmerjs/glimmer-vm/pull/941/files because it can
    // really bork apps under embroider, and we'd like to support at least all
    // active LTS versions of ember.
    patchedSource = transform(source, {
      plugins: [
        function () {
          return {
            visitor: {
              VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
                let id = path.node.id;
                if (id.type === 'Identifier' && id.name === 'Ember' && !replacedVar) {
                  replacedVar = true;
                  path.remove();
                }
              },
              CallExpression: {
                enter(path: NodePath<t.CallExpression>, state: BabelState) {
                  let callee = path.get('callee');
                  if (!callee.isIdentifier() || callee.node.name !== 'define') {
                    return;
                  }
                  let firstArg = path.get('arguments')[0];
                  if (!firstArg.isStringLiteral() || firstArg.node.value !== '@glimmer/syntax') {
                    return;
                  }
                  state.definingGlimmerSyntax = path;
                },
                exit(path: NodePath<t.CallExpression>, state: BabelState) {
                  if (state.definingGlimmerSyntax === path) {
                    state.definingGlimmerSyntax = false;
                  }
                },
              },
              FunctionDeclaration: {
                enter(path: NodePath<t.FunctionDeclaration>, state: BabelState) {
                  if (!state.definingGlimmerSyntax) {
                    return;
                  }
                  let id = path.get('id');
                  if (id.isIdentifier() && id.node.name === 'build') {
                    state.declaringBuildFunction = path;
                  }
                },
                exit(path: NodePath<t.FunctionDeclaration>, state: BabelState) {
                  if (state.declaringBuildFunction === path) {
                    state.declaringBuildFunction = false;
                  }
                },
              },
              SwitchCase: {
                enter(path: NodePath<t.SwitchCase>, state: BabelState) {
                  if (!state.definingGlimmerSyntax) {
                    return;
                  }
                  let test = path.get('test');
                  if (test.isStringLiteral() && test.node.value === 'ElementNode') {
                    state.caseElementNode = path;
                  }
                },
                exit(path: NodePath<t.SwitchCase>, state: BabelState) {
                  if (state.caseElementNode === path) {
                    state.caseElementNode = false;
                  }
                },
              },
              IfStatement(path: NodePath<t.IfStatement>, state: BabelState) {
                if (!state.caseElementNode) {
                  return;
                }
                let test = path.get('test');
                // the place we want is the only if with a computed member
                // expression predicate.
                if (test.isMemberExpression() && test.node.computed) {
                  path.node.alternate = t.ifStatement(
                    t.memberExpression(t.identifier('ast'), t.identifier('selfClosing')),
                    t.blockStatement([
                      t.expressionStatement(
                        t.callExpression(t.memberExpression(t.identifier('output'), t.identifier('push')), [
                          t.stringLiteral(' />'),
                        ])
                      ),
                    ]),
                    path.node.alternate
                  );
                }
              },
            },
          };
        },
      ],
    })!.code!;
  } else {
    // applies to < 3.12 and >= 3.17
    //
    // here we are stripping off the first `var Ember;`. That one small change
    // lets us crack open the file and get access to its internal loader, because
    // we can give it our own predefined `Ember` variable instead, which it will
    // use and put `Ember.__loader` onto.
    patchedSource = transform(source, {
      generatorOpts: {
        compact: true,
      },
      plugins: [
        function () {
          return {
            visitor: {
              VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
                let id = path.node.id;
                if (id.type === 'Identifier' && id.name === 'Ember' && !replacedVar) {
                  replacedVar = true;
                  path.remove();
                }
              },
            },
          };
        },
      ],
    })!.code!;
  }

  if (!replacedVar) {
    throw new Error(
      `didn't find expected source in ${templateCompilerPath}. Maybe we don't support your ember-source version?`
    );
  }

  return `
      let Ember = {};
      ${patchedSource};
      module.exports.Ember = Ember;
  `;
}

interface BabelState {
  definingGlimmerSyntax: NodePath | false;
  declaringBuildFunction: NodePath | false;
  caseElementNode: NodePath | false;
}
