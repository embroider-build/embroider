/*
  This babel plugins is responsible for running custom AST transform in inline
  templates. It doesn't compile to wire format, because it runs at stage1.
*/

import { join } from 'path';
import { TemplateCompiler } from './template-compiler-common';
import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { templateCompilationModules } from '@embroider/shared-internals';

export default function make<Opts>(getCompiler: (opts: Opts) => TemplateCompiler) {
  interface State {
    opts: Opts;
    file: {
      code: string;
      opts: {
        filename: string;
      };
    };
    templateCompiler: TemplateCompiler | undefined;
  }

  function stage1InlineHBSTransform(babel: typeof Babel): unknown {
    let t = babel.types;
    return {
      visitor: {
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

  stage1InlineHBSTransform._parallelBabel = {
    requireFile: __filename,
  };

  stage1InlineHBSTransform.baseDir = function () {
    return join(__dirname, '..');
  };

  function handleTagged(path: NodePath<t.TaggedTemplateExpression>, state: State, t: typeof Babel.types) {
    if (path.node.quasi.expressions.length) {
      throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
    }
    let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
    let compiled = compiler(state).applyTransforms(state.file.opts.filename, template);
    path.get('quasi').replaceWith(t.templateLiteral([t.templateElement({ raw: compiled, cooked: compiled })], []));
  }

  function handleCalled(path: NodePath<t.CallExpression>, state: State, t: typeof Babel.types) {
    let { template, insertRuntimeErrors } = getCallArguments(path);
    let compilerInstance = compiler(state);

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
  }

  function compiler(state: State) {
    if (!state.templateCompiler) {
      state.templateCompiler = getCompiler(state.opts);
    }
    return state.templateCompiler;
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

  return stage1InlineHBSTransform;
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
