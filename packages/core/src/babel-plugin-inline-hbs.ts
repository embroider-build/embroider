import {
  TaggedTemplateExpression,
  CallExpression,
  isStringLiteral,
  templateLiteral,
  templateElement,
  isTaggedTemplateExpression,
  isCallExpression,
  ExpressionStatement,
  stringLiteral,
  File,
} from "@babel/types";
import { NodePath } from "@babel/traverse";
import { join } from "path";
import TemplateCompiler from './template-compiler';
import { identifier, callExpression, memberExpression } from "@babel/types";
import { parse } from '@babel/core';

// These are the known names that people are using to import the `hbs` macro
// from. In theory the original plugin lets people customize these names, but
// that is a terrible idea.
const modulePaths = ['htmlbars-inline-precompile', 'ember-cli-htmlbars-inline-precompile'];

interface State {
  opts: {
    templateCompiler: TemplateCompiler;

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
    }
  };
}

export default function inlineHBSTransform() {
  return {
    visitor: {
      Program: {
        exit(path: NodePath, state: State) {
          if (state.opts.stage === 3) {
            pruneImports(path);
          }
        }
      },
      ReferencedIdentifier(path: NodePath, state: State) {
        for (let modulePath of modulePaths) {
          if (path.referencesImport(modulePath, 'default')) {
            if (isTaggedTemplateExpression(path.parentPath.node)) {
              handleTagged(path.parentPath as NodePath<TaggedTemplateExpression>, state);
            } else if (isCallExpression(path.parentPath.node)) {
              handleCalled(path.parentPath as NodePath<CallExpression>, state);
            }
          }
        }
      }
    }
  };
}

inlineHBSTransform._parallelBabel = {
  requireFile: __filename
};

inlineHBSTransform.baseDir = function() {
  return join(__dirname, '..');
};

function handleTagged(path: NodePath<TaggedTemplateExpression>, state: State) {
  if (path.node.quasi.expressions.length) {
    throw path.buildCodeFrameError("placeholders inside a tagged template string are not supported");
  }
  let template = path.node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
  if (state.opts.stage === 1) {
    let compiled = state.opts.templateCompiler.applyTransforms(state.file.opts.filename, template);
    path.get('quasi').replaceWith(templateLiteral([templateElement({ raw: compiled, cooked: compiled })], []));
  } else {
    let { compiled } = state.opts.templateCompiler.precompile(state.file.opts.filename, template);
    let func = memberExpression(memberExpression(identifier('Ember'), identifier('HTMLBars')), identifier('template'));
    path.replaceWith(callExpression(func, [jsonLiteral(compiled)]));
  }
}

function handleCalled(path: NodePath<CallExpression>, state: State) {
  if (path.node.arguments.length !== 1) {
    throw path.buildCodeFrameError("hbs accepts exactly one argument");
  }
  let arg = path.node.arguments[0];
  if (!isStringLiteral(arg)) {
    throw path.buildCodeFrameError("hbs accepts only a string literal argument");
  }
  let template = arg.value;
  if (state.opts.stage === 1) {
    let compiled = state.opts.templateCompiler.applyTransforms(state.file.opts.filename, template);
    path.get('arguments')[0].replaceWith(stringLiteral(compiled));
  } else {
    let { compiled } = state.opts.templateCompiler.precompile(state.file.opts.filename, template);
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
