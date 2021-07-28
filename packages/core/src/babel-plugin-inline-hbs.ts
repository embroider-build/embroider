/*
  This plugin is used only for Ember < 3.27. For newer Ember's we have a
  different implementation that shares the standard
  babel-plugin-htmlbars-inline-precompile and supports passing Javascript
  lexically scoped names into templates.
*/

import type { types as t } from '@babel/core';
import type * as Babel from '@babel/core';
import type { NodePath } from '@babel/traverse';
import { join } from 'path';
import { TemplateCompiler } from './template-compiler-common';
import { parse } from '@babel/core';
import { ResolvedDep } from './resolver';
import { ImportUtil } from 'babel-import-util';
import { templateCompilationModules } from '@embroider/shared-internals';

type BabelTypes = typeof t;

interface State<O> {
  opts: O;
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

export default function make<O>(getCompiler: (opts: O) => TemplateCompiler) {
  function inlineHBSTransform(babel: typeof Babel): Babel.PluginObj<State<O>> {
    let t = babel.types;
    return {
      visitor: {
        Program: {
          enter(path: NodePath<t.Program>, state: State<O>) {
            state.dependencies = new Map();
            state.adder = new ImportUtil(t, path);
          },
          exit(path: NodePath<t.Program>, state: State<O>) {
            for (let { module, exportedName } of templateCompilationModules) {
              state.adder.removeImport(module, exportedName);
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
        TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>, state: State<O>) {
          for (let { module, exportedName } of templateCompilationModules) {
            if (path.get('tag').referencesImport(module, exportedName)) {
              handleTagged(path, state, t);
            }
          }
        },
        CallExpression(path: NodePath<t.CallExpression>, state: State<O>) {
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

  function handleTagged(path: NodePath<t.TaggedTemplateExpression>, state: State<O>, t: BabelTypes) {
    if (path.node.quasi.expressions.length) {
      throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
    }
    let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
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

  function handleCalled(path: NodePath<t.CallExpression>, state: State<O>, t: BabelTypes) {
    let { template, insertRuntimeErrors } = getCallArguments(path);
    let compilerInstance = compiler(state);

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

  function jsonLiteral(value: unknown | undefined, t: BabelTypes) {
    if (typeof value === 'undefined') {
      return t.identifier('undefined');
    }
    let ast = parse(`a(${value})`, {}) as t.File;
    let statement = ast.program.body[0] as t.ExpressionStatement;
    let expression = statement.expression as t.CallExpression;
    return expression.arguments[0];
  }

  function compiler(state: State<O>) {
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

  function getTemplateString(template: any, path: NodePath<t.CallExpression>): string {
    if (template?.type === 'StringLiteral') {
      return template.value;
    }
    // treat inert TemplateLiteral (without subexpressions) like a StringLiteral
    if (template?.type === 'TemplateLiteral' && !template.expressions.length) {
      return template.quasis[0].value.cooked;
    }
    throw path.buildCodeFrameError('hbs accepts only a string literal argument');
  }

  function getCallArguments(path: NodePath<t.CallExpression>): { template: string; insertRuntimeErrors: boolean } {
    let [template, options] = path.node.arguments;

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
      template: getTemplateString(template, path),
      insertRuntimeErrors,
    };
  }

  return inlineHBSTransform;
}
