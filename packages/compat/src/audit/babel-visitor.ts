import type { NodePath, Node } from '@babel/traverse';
import traverse from '@babel/traverse';
import type { TransformOptions } from '@babel/core';
import { transformSync, types as t } from '@babel/core';
import type { SourceLocation } from '@babel/code-frame';
import { codeFrameColumns } from '@babel/code-frame';

export class VisitorState {}

export interface InternalImport {
  source: string;
  codeFrameIndex: number | undefined;
  specifiers: {
    name: string | NamespaceMarker;
    local: string | null; // can be null when re-exporting, because in that case we import `name` from `source` but don't create any local binding for it
    codeFrameIndex: number | undefined;
  }[];
}

export interface NamespaceMarker {
  isNamespace: true;
}

export function isNamespaceMarker(value: string | NamespaceMarker): value is NamespaceMarker {
  return typeof value !== 'string';
}

export interface ExportAll {
  all: string;
}

export function auditJS(rawSource: string, filename: string, babelConfig: TransformOptions, frames: CodeFrameStorage) {
  if (!babelConfig.ast) {
    throw new Error(`module auditing requires a babel config with ast: true`);
  }

  let imports = [] as InternalImport[];
  let exports = new Set<string | ExportAll>();
  let problems = [] as { message: string; detail: string; codeFrameIndex: number | undefined }[];

  /* eslint-disable @typescript-eslint/no-inferrable-types */
  // These are not really inferrable. Without explicit declarations, TS thinks
  // they're always false because it doesn't know the handler methods run
  // synchronously
  let sawModule: boolean = false;
  let sawExports: boolean = false;
  let sawDefine: boolean = false;
  /* eslint-enable @typescript-eslint/no-inferrable-types */

  let { ast, code } = transformSync(rawSource, Object.assign({ filename: filename }, babelConfig))!;
  let saveCodeFrame = frames.forSource(rawSource);

  traverse(ast!, {
    Identifier(path: NodePath<t.Identifier>) {
      if (path.node.name === 'module' && isFreeVariable(path)) {
        sawModule = true;
      } else if (path.node.name === 'exports' && isFreeVariable(path)) {
        sawExports = true;
      } else if (path.node.name === 'define' && isFreeVariable(path)) {
        sawDefine = true;
      }
      if (inExportDeclarationContext(path)) {
        exports.add(path.node.name);
      }
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      let callee = path.get('callee');
      if (callee.referencesImport('@embroider/macros', 'importSync') || t.isImport(callee.node)) {
        let arg = path.node.arguments[0];
        if (arg.type === 'StringLiteral') {
          imports.push({
            source: arg.value,
            codeFrameIndex: saveCodeFrame(arg),
            specifiers: [],
          });
        } else if (arg.type === 'BinaryExpression') {
          // ignore binary expressions. Vite uses these (somehow) in the `@vite/client` import
        } else {
          problems.push({
            message: `audit tool is unable to understand this usage of ${
              t.isImport(callee.node) ? 'import' : 'importSync'
            }`,
            detail: arg.type,
            codeFrameIndex: saveCodeFrame(arg),
          });
        }
      }
    },
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      imports.push({
        source: path.node.source.value,
        codeFrameIndex: saveCodeFrame(path.node.source),
        specifiers: [],
      });
    },
    ImportDefaultSpecifier(path: NodePath<t.ImportDefaultSpecifier>) {
      imports[imports.length - 1].specifiers.push({
        name: 'default',
        local: path.node.local.name,
        codeFrameIndex: saveCodeFrame(path.node),
      });
    },
    ImportNamespaceSpecifier(path: NodePath<t.ImportNamespaceSpecifier>) {
      imports[imports.length - 1].specifiers.push({
        name: { isNamespace: true },
        local: path.node.local.name,
        codeFrameIndex: saveCodeFrame(path.node),
      });
    },
    ImportSpecifier(path: NodePath<t.ImportSpecifier>) {
      imports[imports.length - 1].specifiers.push({
        name: name(path.node.imported),
        local: path.node.local.name,
        codeFrameIndex: saveCodeFrame(path.node),
      });
    },
    ExportDefaultDeclaration(_path: NodePath<t.ExportDefaultDeclaration>) {
      exports.add('default');
    },
    ExportSpecifier(path: NodePath<t.ExportSpecifier>) {
      exports.add(name(path.node.exported));
      if (path.parent.type === 'ExportNamedDeclaration' && path.parent.source) {
        imports[imports.length - 1].specifiers.push({
          name: name(path.node.local),
          local: null, // re-exports don't create local bindings
          codeFrameIndex: saveCodeFrame(path.node),
        });
      }
    },
    ExportNamespaceSpecifier(path: NodePath<t.ExportNamespaceSpecifier>) {
      exports.add(name(path.node.exported));
      if (path.parent.type === 'ExportNamedDeclaration' && path.parent.source) {
        imports[imports.length - 1].specifiers.push({
          name: { isNamespace: true },
          local: null, // re-exports don't create local bindings
          codeFrameIndex: saveCodeFrame(path.node),
        });
      }
    },
    ExportAllDeclaration(path: NodePath<t.ExportAllDeclaration>) {
      exports.add({ all: path.node.source.value });
      imports.push({
        source: path.node.source.value,
        codeFrameIndex: saveCodeFrame(path.node.source),
        specifiers: [
          {
            name: { isNamespace: true },
            local: null,
            codeFrameIndex: saveCodeFrame(path.node),
          },
        ],
      });
    },
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.source) {
        imports.push({
          source: path.node.source.value,
          codeFrameIndex: saveCodeFrame(path.node.source),
          specifiers: [],
        });
      }
    },
  });

  let isCJS = imports.length === 0 && exports.size === 0 && (sawModule || sawExports);
  let isAMD = imports.length === 0 && exports.size === 0 && sawDefine;
  return { imports, exports, isCJS, isAMD, problems, transpiledContent: code! };
}

export class CodeFrameStorage {
  private codeFrames = [] as { rawSourceIndex: number; loc: SourceLocation }[];
  private rawSources = [] as string[];

  forSource(rawSource: string): (node: { loc?: SourceLocation | null }) => number | undefined {
    let rawSourceIndex: number | undefined;
    return (node: { loc?: SourceLocation | null | undefined }) => {
      let loc = node.loc;
      if (!loc) {
        return;
      }
      if (rawSourceIndex == null) {
        rawSourceIndex = this.rawSources.length;
        this.rawSources.push(rawSource);
      }
      let codeFrameIndex = this.codeFrames.length;
      this.codeFrames.push({
        rawSourceIndex,
        loc,
      });
      return codeFrameIndex;
    };
  }

  render(codeFrameIndex: number | undefined): string | undefined {
    if (codeFrameIndex != null) {
      let { loc, rawSourceIndex } = this.codeFrames[codeFrameIndex];
      return codeFrameColumns(this.rawSources[rawSourceIndex], loc, { highlightCode: true });
    }
  }
}

function name(node: t.StringLiteral | t.Identifier): string {
  if (t.isStringLiteral(node)) {
    return node.value;
  } else {
    return node.name;
  }
}

function isFreeVariable(path: NodePath<t.Identifier>) {
  return !path.scope.hasBinding(path.node.name);
}

const contextCache: WeakMap<Node, boolean> = new WeakMap();

function inExportDeclarationContext(path: NodePath): boolean {
  if (contextCache.has(path.node)) {
    return contextCache.get(path.node)!;
  } else {
    let answer = _inExportDeclarationContext(path);
    contextCache.set(path.node, answer);
    return answer;
  }
}

function _inExportDeclarationContext(path: NodePath): boolean {
  let parent = path.parent;
  switch (parent.type) {
    case 'ExportNamedDeclaration':
      return parent.declaration === path.node;
    case 'VariableDeclaration':
    case 'ObjectPattern':
    case 'ArrayPattern':
    case 'RestElement':
      return inExportDeclarationContext(path.parentPath!);
    case 'VariableDeclarator':
      return parent.id === path.node && inExportDeclarationContext(path.parentPath!);
    case 'ObjectProperty':
      return parent.value === path.node && inExportDeclarationContext(path.parentPath!);
    case 'AssignmentPattern':
      return parent.left === path.node && inExportDeclarationContext(path.parentPath!);
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
      return parent.id === path.node && inExportDeclarationContext(path.parentPath!);
    default:
      return false;
  }
}
