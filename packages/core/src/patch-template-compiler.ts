import {
  CallExpression,
  FunctionDeclaration,
  VariableDeclarator,
  SwitchCase,
  IfStatement,
  ifStatement,
  memberExpression,
  identifier,
  blockStatement,
  callExpression,
  expressionStatement,
  stringLiteral,
} from '@babel/types';
import { NodePath } from '@babel/traverse';
import { transform } from '@babel/core';

export function patch(source: string, templateCompilerPath: string) {
  let replacedVar = false;

  // patch applies to ember 3.12 through 3.16. The template compiler contains a
  // comment with the version.
  let needsPatch = /@version\s+3\.1[23456][^\d]/.test(source);

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
  let patchedSource = transform(source, {
    plugins: [
      function() {
        return {
          visitor: {
            VariableDeclarator(path: NodePath<VariableDeclarator>) {
              let id = path.node.id;
              if (id.type === 'Identifier' && id.name === 'Ember' && !replacedVar) {
                replacedVar = true;
                path.remove();
              }
            },
            CallExpression: {
              enter(path: NodePath<CallExpression>, state: BabelState) {
                if (!needsPatch) {
                  return;
                }
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
              exit(path: NodePath<CallExpression>, state: BabelState) {
                if (state.definingGlimmerSyntax === path) {
                  state.definingGlimmerSyntax = false;
                }
              },
            },
            FunctionDeclaration: {
              enter(path: NodePath<FunctionDeclaration>, state: BabelState) {
                if (!state.definingGlimmerSyntax) {
                  return;
                }
                let id = path.get('id');
                if (id.isIdentifier() && id.node.name === 'build') {
                  state.declaringBuildFunction = path;
                }
              },
              exit(path: NodePath<FunctionDeclaration>, state: BabelState) {
                if (state.declaringBuildFunction === path) {
                  state.declaringBuildFunction = false;
                }
              },
            },
            SwitchCase: {
              enter(path: NodePath<SwitchCase>, state: BabelState) {
                if (!state.definingGlimmerSyntax) {
                  return;
                }
                let test = path.get('test');
                if (test.isStringLiteral() && test.node.value === 'ElementNode') {
                  state.caseElementNode = path;
                }
              },
              exit(path: NodePath<SwitchCase>, state: BabelState) {
                if (state.caseElementNode === path) {
                  state.caseElementNode = false;
                }
              },
            },
            IfStatement(path: NodePath<IfStatement>, state: BabelState) {
              if (!state.caseElementNode) {
                return;
              }
              let test = path.get('test');
              // the place we want is the only if with a computed member
              // expression predicate.
              if (test.isMemberExpression() && test.node.computed) {
                path.node.alternate = ifStatement(
                  memberExpression(identifier('ast'), identifier('selfClosing')),
                  blockStatement([
                    expressionStatement(
                      callExpression(memberExpression(identifier('output'), identifier('push')), [stringLiteral(' />')])
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

  if (!replacedVar) {
    throw new Error(
      `didn't find expected source in ${templateCompilerPath}. Maybe we don't support your ember-source version?`
    );
  }
  return `
  let module = { exports: {} };
  let Ember = {};
  ${patchedSource};
  module.exports.Ember = Ember;
  return module.exports
  `;
}

interface BabelState {
  definingGlimmerSyntax: NodePath | false;
  declaringBuildFunction: NodePath | false;
  caseElementNode: NodePath | false;
}
