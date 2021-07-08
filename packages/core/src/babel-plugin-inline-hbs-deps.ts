import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { join } from 'path';
import { TemplateCompiler } from './template-compiler-common';
import { ResolvedDep } from './resolver';
import { templateCompilationModules } from '@embroider/shared-internals';
import { ImportUtil } from 'babel-import-util';

/*
  In order to coordinate with babel-plugin-htmlbars-inline-precompile, we need
  to give it a `precompile` function that, as a side-effect, captures the
  dependencies needed within the current file. We do this coordination via this
  module-scoped variable, which is safe given Javascript's single-threaded
  nature and babel's synchronicity.
*/
let currentState: State | undefined;

/*
  This is the precompile function you should pass to
  babel-plugin-htmlbars-inline-precompile.
*/
export function precompile(templateSource: string, options: Record<string, unknown>) {
  if (!currentState) {
    throw new Error(
      `bug: babel-plugin-htmlbars-inline-precompile and babel-plugin-inline-hbs-deps aren't coordinating correctly`
    );
  }
  let { compiled, dependencies } = compiler(currentState).precompile(templateSource, {
    filename: currentState.file.opts.filename,
    ...options,
  });
  for (let dep of dependencies) {
    currentState.dependencies.set(dep.runtimeName, dep);
  }
  return compiled;
}

interface State {
  opts: {};
  file: {
    code: string;
    opts: {
      filename: string;
    };
  };
  dependencies: Map<string, ResolvedDep>;
  getCompiler: (opts: any) => TemplateCompiler;
  templateCompiler: TemplateCompiler | undefined;
  adder: ImportUtil;
  emittedCallExpressions: Set<t.Node>;
}

export default function make(getCompiler: (opts: any) => TemplateCompiler) {
  function inlineHBSTransform(babel: typeof Babel): unknown {
    let t = babel.types;
    return {
      visitor: {
        Program: {
          enter(path: NodePath<t.Program>, state: State) {
            state.dependencies = new Map();
            state.adder = new ImportUtil(t, path);
            state.emittedCallExpressions = new Set();
            state.getCompiler = getCompiler;
            currentState = state;
          },
          exit(path: NodePath<t.Program>, state: State) {
            // we are responsible for rewriting all usages of all the
            // templateCompilationModules to standardize on
            // @ember/template-compilation, so all imports other than that one
            // need to be cleaned up here.
            for (let moduleConfig of templateCompilationModules) {
              if (moduleConfig.module !== '@ember/template-compilation') {
                state.adder.removeImport(moduleConfig.module, moduleConfig.exportedName);
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
            currentState = undefined;
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
          if (state.emittedCallExpressions.has(path.node)) {
            return;
          }
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

  function handleTagged(path: NodePath<t.TaggedTemplateExpression>, state: State, t: typeof Babel.types) {
    if (path.node.quasi.expressions.length) {
      throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
    }
    let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
    let newCallExpression = t.callExpression(
      state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'),
      [
        t.stringLiteral(template),
        // TODO: here is where we will put scope once ember support that
      ]
    );

    state.emittedCallExpressions.add(newCallExpression);
    path.replaceWith(newCallExpression);
  }

  function handleCalled(path: NodePath<t.CallExpression>, state: State, t: typeof Babel.types) {
    let newCallExpression = t.callExpression(
      state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'),
      path.node.arguments
    );
    state.emittedCallExpressions.add(newCallExpression);
    path.replaceWith(newCallExpression);
  }

  function amdDefine(runtimeName: string, importCounter: number, t: typeof Babel.types) {
    return t.expressionStatement(
      t.callExpression(t.memberExpression(t.identifier('window'), t.identifier('define')), [
        t.stringLiteral(runtimeName),
        t.functionExpression(null, [], t.blockStatement([t.returnStatement(t.identifier(`a${importCounter}`))])),
      ])
    );
  }
  return inlineHBSTransform;
}

function compiler(state: State) {
  if (!state.templateCompiler) {
    state.templateCompiler = state.getCompiler(state.opts);
  }
  return state.templateCompiler;
}
