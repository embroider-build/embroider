import {
  TaggedTemplateExpression,
  CallExpression,
  templateLiteral,
  templateElement,
  ExpressionStatement,
  stringLiteral,
  File,
  Program,
  functionExpression,
  blockStatement,
  throwStatement,
  newExpression,
  importDeclaration,
  importDefaultSpecifier,
  expressionStatement,
  returnStatement,
  identifier,
  callExpression,
  memberExpression,
} from '@babel/types';
import type { NodePath } from '@babel/traverse';
import { parse } from '@babel/core';
import { join } from 'path';
import { NodeTemplateCompiler, NodeTemplateCompilerParams } from './template-compiler-node';
import type { ResolvedDep } from './resolver';

// These are the known names that people are using to import the `hbs` macro
// from. In theory the original plugin lets people customize these names, but
// that is a terrible idea.
const modulePaths = [
  ['htmlbars-inline-precompile', 'default'],
  ['ember-cli-htmlbars-inline-precompile', 'default'],
  ['ember-cli-htmlbars', 'hbs'],
];

interface State {
  opts: {
    templateCompiler: NodeTemplateCompilerParams;

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
  templateCompiler: NodeTemplateCompiler | undefined;
}

export type Params = State['opts'];

export default function inlineHBSTransform(): unknown {
  return {
    visitor: {
      Program: {
        enter(_: NodePath, state: State) {
          state.dependencies = new Map();
        },
        exit(path: NodePath<Program>, state: State) {
          if (state.opts.stage === 3) {
            pruneImports(path);
          }
          let counter = 0;
          for (let dep of state.dependencies.values()) {
            path.node.body.unshift(amdDefine(dep.runtimeName, counter));
            path.node.body.unshift(
              importDeclaration([importDefaultSpecifier(identifier(`a${counter++}`))], stringLiteral(dep.path))
            );
          }
        },
      },
      TaggedTemplateExpression(path: NodePath<TaggedTemplateExpression>, state: State) {
        for (let [modulePath, identifier] of modulePaths) {
          if (path.get('tag').referencesImport(modulePath, identifier)) {
            handleTagged(path, state);
          }
        }
      },
      CallExpression(path: NodePath<CallExpression>, state: State) {
        for (let [modulePath, identifier] of modulePaths) {
          if (path.get('callee').referencesImport(modulePath, identifier)) {
            handleCalled(path, state);
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

function handleTagged(path: NodePath<TaggedTemplateExpression>, state: State) {
  if (path.node.quasi.expressions.length) {
    throw path.buildCodeFrameError('placeholders inside a tagged template string are not supported');
  }
  let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
  if (state.opts.stage === 1) {
    let compiled = compiler(state).applyTransforms(state.file.opts.filename, template);
    path.get('quasi').replaceWith(templateLiteral([templateElement({ raw: compiled, cooked: compiled })], []));
  } else {
    let { compiled, dependencies } = compiler(state).precompile(state.file.opts.filename, template);
    for (let dep of dependencies) {
      state.dependencies.set(dep.runtimeName, dep);
    }
    let func = memberExpression(memberExpression(identifier('Ember'), identifier('HTMLBars')), identifier('template'));
    path.replaceWith(callExpression(func, [jsonLiteral(compiled)]));
  }
}

function handleCalled(path: NodePath<CallExpression>, state: State) {
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
    (path.get('arguments')[0] as NodePath).replaceWith(stringLiteral(compiled));
  } else {
    let result: ReturnType<NodeTemplateCompiler['precompile']>;
    try {
      result = compilerInstance.precompile(state.file.opts.filename, template);
    } catch (err) {
      if (insertRuntimeErrors) {
        path.replaceWith(
          callExpression(
            functionExpression(
              null,
              [],
              blockStatement([throwStatement(newExpression(identifier('Error'), [stringLiteral(err.message)]))])
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
    let func = memberExpression(memberExpression(identifier('Ember'), identifier('HTMLBars')), identifier('template'));
    path.replaceWith(callExpression(func, [jsonLiteral(compiled)]));
  }
}

function pruneImports(path: NodePath) {
  if (!path.isProgram()) {
    return;
  }
  for (let topLevelPath of path.get('body')) {
    if (topLevelPath.isImportDeclaration()) {
      let modulePath = topLevelPath.get('source').node.value;
      if (modulePaths.find(p => p[0] === modulePath)) {
        topLevelPath.remove();
      }
    }
  }
}

function jsonLiteral(value: unknown | undefined) {
  if (typeof value === 'undefined') {
    return identifier('undefined');
  }
  let ast = parse(`a(${value})`, {}) as File;
  let statement = ast.program.body[0] as ExpressionStatement;
  let expression = statement.expression as CallExpression;
  return expression.arguments[0];
}

function compiler(state: State) {
  if (!state.templateCompiler) {
    state.templateCompiler = new NodeTemplateCompiler(state.opts.templateCompiler);
  }
  return state.templateCompiler;
}

function amdDefine(runtimeName: string, importCounter: number) {
  return expressionStatement(
    callExpression(memberExpression(identifier('window'), identifier('define')), [
      stringLiteral(runtimeName),
      functionExpression(null, [], blockStatement([returnStatement(identifier(`a${importCounter}`))])),
    ])
  );
}

function getCallArguments(path: NodePath<CallExpression>): { template: string; insertRuntimeErrors: boolean } {
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
