import {
  TaggedTemplateExpression,
  CallExpression,
  isStringLiteral,
  templateLiteral,
  templateElement,
  isTaggedTemplateExpression,
  isCallExpression,
  stringLiteral,
} from "@babel/types";
import { NodePath } from "@babel/traverse";
import { PluginItem } from "@babel/core";
import { join } from "path";
import ASTPrecompiler from './ast-precompiler';

// These are the known names that people are using to import the `hbs` macro
// from. In theory the plugin lets people customize these names, but that is a
// terrible idea.
const modulePaths = ['htmlbars-inline-precompile', 'ember-cli-htmlbars-inline-precompile'];

type Precompiler = ASTPrecompiler["precompile"];

interface State {
  opts: {
    precompile: Precompiler;
  };
  file: {
    code: string;
    opts: {
      filename: string;
    }
  };
}

export default function inlineApplyASTTransform() {
  return {
    visitor: {
      ReferencedIdentifier(path: NodePath, state: State) {
        for (let modulePath of modulePaths) {
          if (path.referencesImport(modulePath, 'default')) {
            if (isTaggedTemplateExpression(path.parentPath.node)) {
              handleTagged(path.parentPath.get('quasi') as NodePath, path.parentPath.node, state);
            } else if (isCallExpression(path.parentPath.node)) {
              handleCalled((path.parentPath.get('arguments') as NodePath[])[0] as NodePath, path.parentPath.node, state);
            }
          }
        }
      }
    }
  };
}

inlineApplyASTTransform._parallelBabel = {
  requireFile: __filename
};

inlineApplyASTTransform.baseDir = function() {
  return join(__dirname, '..');
};

function handleTagged(pathToReplace: NodePath, node: TaggedTemplateExpression, state: State) {
  if (node.quasi.expressions.length) {
    throw pathToReplace.buildCodeFrameError("placeholders inside a tagged template string are not supported");
  }
  let template = node.quasi.quasis.map(quasi => quasi.value.cooked).join('');
  let compiled = state.opts.precompile(template, state.file.opts.filename);
  pathToReplace.replaceWith(templateLiteral([templateElement({ raw: compiled, cooked: compiled })], []));
}

function handleCalled(pathToReplace: NodePath, node: CallExpression, state: State) {
  if (node.arguments.length !== 1) {
    throw pathToReplace.buildCodeFrameError("hbs accepts exactly one argument");
  }
  let arg = node.arguments[0];
  if (!isStringLiteral(arg)) {
    throw pathToReplace.buildCodeFrameError("hbs accepts only a string literal argument");
  }
  let template = arg.value;
  let compiled = state.opts.precompile(template, state.file.opts.filename);
  pathToReplace.replaceWith(stringLiteral(compiled));
}

function matchesSourceFile(filename: string) {
  return /babel-plugin-htmlbars-inline-precompile\/(index|lib\/require-from-worker)\.js$/.test(filename);
}

function hasProperties(item: any) {
  return item && (typeof item === 'object' || typeof item === 'function');
}

export function isInlinePrecompilePlugin(item: PluginItem) {
  if (typeof item === 'string') {
    return matchesSourceFile(item);
  }
  if (hasProperties(item) && (item as any)._parallelBabel) {
    return matchesSourceFile((item as any)._parallelBabel.requireFile);
  }
  if (Array.isArray(item) && item.length > 0) {
    if (typeof item[0] === 'string') {
      return matchesSourceFile(item[0]);
    }
    if (hasProperties(item[0]) && (item[0] as any)._parallelBabel) {
      return matchesSourceFile((item[0] as any)._parallelBabel.requireFile);
    }
  }
  return false;
}
