import type { NodePath } from '@babel/traverse';
import type * as Babel from '@babel/core';
import type { types as t } from '@babel/core';
import { join } from 'path';
import { TemplateCompiler } from './template-compiler-common';
import { ResolvedDep } from './resolver';
import { templateCompilationModules } from '@embroider/shared-internals';
import { ImportAdder } from './babel-import-adder';

// todo: this is not the right kind of key, because our precompile function
// won't have access to the node. Instead we should use the actual arguments to
// precompile.
const precompileCache = new WeakMap<t.StringLiteral, string>();

export function precompile() {
  //todo
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
  templateCompiler: TemplateCompiler | undefined;
  adder: ImportAdder;
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
            state.adder = new ImportAdder(t, path);
            state.emittedCallExpressions = new Set();
          },
          exit(path: NodePath<t.Program>, state: State) {
            pruneImports(path);
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

    let { compiled, dependencies } = compiler(state).precompile(state.file.opts.filename, template);
    for (let dep of dependencies) {
      state.dependencies.set(dep.runtimeName, dep);
    }

    let untranspiledTemplate = t.stringLiteral(template);
    precompileCache.set(untranspiledTemplate, compiled);

    let newCallExpression = t.callExpression(
      state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'),
      [
        untranspiledTemplate,
        // NEXT: put the dependencies in scope here when a new flag is enabled
      ]
    );

    state.emittedCallExpressions.add(newCallExpression);
    path.replaceWith(newCallExpression);
  }

  // TODO: if the user provided scope and didn't set strict mode, that's an
  // error (because we don't merge scopes, but they're relying on us to lookup
  // deps). If the user provided scope and did set strict mode, we just skip
  // over doing any dep discovery because they don't need it. Else, they don't
  // have a preexisting scope so we can add one if the new flag is set.
  function handleCalled(path: NodePath<t.CallExpression>, state: State, t: typeof Babel.types) {
    let { template, insertRuntimeErrors } = getCallArguments(path);
    let compilerInstance = compiler(state);

    let result: ReturnType<TemplateCompiler['precompile']>;
    try {
      result = compilerInstance.precompile(state.file.opts.filename, template);
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

    let untranspiledTemplate = t.stringLiteral(template);
    let newCallExpression = t.callExpression(
      state.adder.import(path, '@ember/template-compilation', 'precompileTemplate'),
      [untranspiledTemplate]
    );

    state.emittedCallExpressions.add(newCallExpression);
    path.replaceWith(newCallExpression);
  }

  function compiler(state: State) {
    if (!state.templateCompiler) {
      state.templateCompiler = getCompiler(state.opts);
    }
    return state.templateCompiler;
  }

  function amdDefine(runtimeName: string, importCounter: number, t: typeof Babel.types) {
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

// we rewrite all inline templates to use `precompileTemplate` from
// `@ember/template-precompilation` because that's the one that supports scope.
// We need to remove all others.
function pruneImports(path: NodePath<t.Program>) {
  for (let topLevelPath of path.get('body')) {
    if (topLevelPath.isImportDeclaration()) {
      let modulePath = topLevelPath.get('source').node.value;
      if (
        modulePath !== '@ember/template-precompilation' &&
        templateCompilationModules.find(p => p.module === modulePath)
      ) {
        topLevelPath.remove();
      }
    }
  }
}
