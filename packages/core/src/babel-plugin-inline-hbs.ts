/*
  This plugin is used only for Ember < 3.27. For newer Ember's we have a
  different implementation that shares the standard
  babel-plugin-htmlbars-inline-precompile and supports passing Javascript
  lexically scoped names into templates.
*/

import type * as t from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { join } from 'path';
import { TemplateCompiler } from './template-compiler-common';
import { parse } from '@babel/core';
import { ResolvedDep } from './resolver';
import { ImportUtil } from 'babel-import-util';
import { templateCompilationModules } from '@embroider/shared-internals';

type BabelTypes = typeof t;

interface State {
  opts: {
    // the stages here correspond to the two places in the overall Embroider
    // architecture that this transform applies. In stage1 HBS stays as HBS, but
    // we still need to run any custom AST transforms inside that HBS. In
    // stage3, we are running more like the traditional
    // ember-cli-htmlbars-inline-precompile by compiling the HBS to Javascript.
    stage: 1 | 3;
  };
  file: {
    code: string;
    opts: {
      filename: string;
    };
  };
  dependencies: Map<string, ResolvedDep>;
  templateCompiler: TemplateCompiler | undefined;
  adder: ImportUtil;
}

export type Params = State['opts'];

export default function make(getCompiler: (opts: any) => TemplateCompiler) {
  function inlineHBSTransform(babel: unknown): unknown {
    let t = (babel as any).types as BabelTypes;
    return {
      visitor: {
        Program: {
          enter(path: NodePath<t.Program>, state: State) {
            state.dependencies = new Map();
            state.adder = new ImportUtil(t, path);
          },
          exit(path: NodePath<t.Program>, state: State) {
            if (state.opts.stage === 3) {
              for (let { module, exportedName } of templateCompilationModules) {
                state.adder.removeImport(module, exportedName);
              }
            }
            let counter = 0;
            for (let dep of state.dependencies.values()) {
              path.node.body.unshift(amdDefine(dep.runtimeName, counter, t));
              path.node.body.unshift(
                t.importDeclaration(
                  [t.importDefaultSpecifier(t.identifier(`a${counter++}`))],
                  t.stringLiteral(dep.path)
                )
              );
            }
          },
        },
        TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>, state: State) {
          for (let { module, exportedName } of templateCompilationModules) {
            if (path.get('tag').referencesImport(module, exportedName)) {
              handleTagged(path, state, t);
            }
          }
        },
        CallExpression(path: NodePath<t.CallExpression>, state: State) {
          for (let { module, exportedName } of templateCompilationModules) {
            if (path.get('callee').referencesImport(module, exportedName)) {
              handleCalled(path, state, t);
            }
          }
        },
      },
    };
  }

  inlineHBSTransform._parallelBabel = {
    requireFile: __filename,
  };

  inlineHBSTransform.baseDir = function () {
    return join(__dirname, '..');
  };

  function handleTagged(path: NodePath<t.TaggedTemplateExpression>, state: State, t: BabelTypes) {
    if (path.node.quasi.expressions.length) {
      throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
    }
    let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
    if (state.opts.stage === 1) {
      let compiled = compiler(state).applyTransforms(state.file.opts.filename, template);
      path.get('quasi').replaceWith(t.templateLiteral([t.templateElement({ raw: compiled, cooked: compiled })], []));
    } else {
      let { compiled, dependencies } = compiler(state).precompile(template, { filename: state.file.opts.filename });
      for (let dep of dependencies) {
        state.dependencies.set(dep.runtimeName, dep);
      }

      path.replaceWith(
        t.callExpression(state.adder.import(path, '@ember/template-factory', 'createTemplateFactory'), [
          jsonLiteral(compiled, t),
        ])
      );
    }
  }

  function handleCalled(path: NodePath<t.CallExpression>, state: State, t: BabelTypes) {
    let { template, insertRuntimeErrors } = getCallArguments(path);
    let compilerInstance = compiler(state);

    if (state.opts.stage === 1) {
      let compiled: string;
      try {
        compiled = compilerInstance.applyTransforms(state.file.opts.filename, template);
      } catch (err) {
        if (insertRuntimeErrors) {
          // in stage 1 we just leave the bad template in place (we were only
          // trying to run transforms and re-emit hbs), so that it will be handled
          // at stage3 instead.
          return;
        }
        throw err;
      }
      (path.get('arguments')[0] as NodePath).replaceWith(t.stringLiteral(compiled));
    } else {
      let result: ReturnType<TemplateCompiler['precompile']>;
      try {
        result = compilerInstance.precompile(template, { filename: state.file.opts.filename, insertRuntimeErrors });
      } catch (err) {
        if (insertRuntimeErrors) {
          path.replaceWith(
            t.callExpression(
              t.functionExpression(
                null,
                [],
                t.blockStatement([
                  t.throwStatement(t.newExpression(t.identifier('Error'), [t.stringLiteral(err.message)])),
                ])
              ),
              []
            )
          );
          return;
        }
        throw err;
      }
      let { compiled, dependencies } = result;
      for (let dep of dependencies) {
        state.dependencies.set(dep.runtimeName, dep);
      }
      path.replaceWith(
        t.callExpression(state.adder.import(path, '@ember/template-factory', 'createTemplateFactory'), [
          jsonLiteral(compiled, t),
        ])
      );
    }
  }

  function jsonLiteral(value: unknown | undefined, t: BabelTypes) {
    if (typeof value === 'undefined') {
      return t.identifier('undefined');
    }
    let ast = parse(`a(${value})`, {}) as t.File;
    let statement = ast.program.body[0] as t.ExpressionStatement;
    let expression = statement.expression as t.CallExpression;
    return expression.arguments[0];
  }

  function compiler(state: State) {
    if (!state.templateCompiler) {
      state.templateCompiler = getCompiler(state.opts);
    }
    return state.templateCompiler;
  }

  function amdDefine(runtimeName: string, importCounter: number, t: BabelTypes) {
    return t.expressionStatement(
      t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
        t.stringLiteral(runtimeName),
        t.functionExpression(null, [], t.blockStatement([t.returnStatement(t.identifier(`a${importCounter}`))])),
      ])
    );
  }

  function getCallArguments(path: NodePath<t.CallExpression>): { template: string; insertRuntimeErrors: boolean } {
    let [template, options] = path.node.arguments;

    if (template?.type !== 'StringLiteral') {
      throw path.buildCodeFrameError('hbs accepts only a string literal argument');
    }

    let insertRuntimeErrors =
      options?.type === 'ObjectExpression' &&
      options.properties.some(
        prop =>
          prop.type === 'ObjectProperty' &&
          prop.computed === false &&
          prop.key.type === 'Identifier' &&
          prop.key.name === 'insertRuntimeErrors' &&
          prop.value.type === 'BooleanLiteral' &&
          prop.value.value
      );

    return {
      template: template.value,
      insertRuntimeErrors,
    };
  }

  return inlineHBSTransform;
}
