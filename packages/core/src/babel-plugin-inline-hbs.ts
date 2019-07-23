import {
  TaggedTemplateExpression,
  CallExpression,
  isStringLiteral,
  templateLiteral,
  templateElement,
  ExpressionStatement,
  stringLiteral,
  File,
  Program,
  functionExpression,
  blockStatement,
} from '@babel/types';
import { NodePath } from '@babel/traverse';
import { join } from 'path';
import TemplateCompiler, { rehydrate } from './template-compiler';
import { identifier, callExpression, memberExpression } from '@babel/types';
import { parse } from '@babel/core';
import { ResolvedDep } from './resolver';
import { importDeclaration } from '@babel/types';
import { importDefaultSpecifier } from '@babel/types';
import { expressionStatement } from '@babel/types';
import { returnStatement } from '@babel/types';

// These are the known names that people are using to import the `hbs` macro
// from. In theory the original plugin lets people customize these names, but
// that is a terrible idea.
const modulePaths = ['htmlbars-inline-precompile', 'ember-cli-htmlbars-inline-precompile'];

interface State {
  opts: {
    // it can be unknown if somebody serialized our babel config on us, in
    // which case we'll need to rehydrate it ourself
    templateCompiler: unknown;

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
}

export default function inlineHBSTransform() {
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
        for (let modulePath of modulePaths) {
          if (path.get('tag').referencesImport(modulePath, 'default')) {
            handleTagged(path, state);
          }
        }
      },
      CallExpression(path: NodePath<CallExpression>, state: State) {
        for (let modulePath of modulePaths) {
          if (path.get('callee').referencesImport(modulePath, 'default')) {
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

inlineHBSTransform.baseDir = function() {
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
  if (path.node.arguments.length !== 1) {
    throw path.buildCodeFrameError('hbs accepts exactly one argument');
  }
  let arg = path.node.arguments[0];
  if (!isStringLiteral(arg)) {
    throw path.buildCodeFrameError('hbs accepts only a string literal argument');
  }
  let template = arg.value;
  if (state.opts.stage === 1) {
    let compiled = compiler(state).applyTransforms(state.file.opts.filename, template);
    (path.get('arguments')[0] as NodePath).replaceWith(stringLiteral(compiled));
  } else {
    let { compiled, dependencies } = compiler(state).precompile(state.file.opts.filename, template);
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
    if (topLevelPath.isImportDeclaration() && modulePaths.includes(topLevelPath.get('source').node.value)) {
      topLevelPath.remove();
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
    state.templateCompiler = rehydrate(state.opts.templateCompiler);
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
