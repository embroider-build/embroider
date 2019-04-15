import packageName from './package-name';
import { join, relative, dirname, resolve } from 'path';
import { NodePath } from '@babel/traverse';
import {
  blockStatement,
  callExpression,
  expressionStatement,
  functionExpression,
  identifier,
  importDeclaration,
  importDefaultSpecifier,
  memberExpression,
  Program,
  returnStatement,
  stringLiteral,
} from '@babel/types';
import PackageCache from './package-cache';
import Package from './package';
import { pathExistsSync } from 'fs-extra';
import { Memoize } from 'typescript-memoize';

interface State {
  emberCLIVanillaJobs: Function[];
  generatedRequires: Set<Node>;
  opts: {
    rename?: {
      [fromName: string]: string;
    };
    extraImports?: {
      absPath: string;
      target: string;
      runtimeName?: string;
    }[];
  };
}

export type Options = State['opts'];

const packageCache = PackageCache.shared('embroider-stage3');

function adjustSpecifier(specifier: string, sourceFile: AdjustFile, opts: State['opts']) {
  let name = packageName(specifier);
  if (!name) {
    return specifier;
  }

  if (opts.rename && opts.rename[name]) {
    return specifier.replace(name, opts.rename[name]);
  }

  let pkg = sourceFile.owningPackage();
  if (!pkg) {
    return specifier;
  }

  if (pkg.meta['auto-upgraded'] && pkg.name === name) {
    // we found a self-import, make it relative. Only auto-upgraded packages get
    // this help, v2 packages are natively supposed to use explicit hbs
    // extensions, and we want to push them all to do that correctly.
    let fullPath = specifier.replace(name, pkg.root);
    let relativePath = relative(dirname(sourceFile.name), fullPath);
    if (relativePath[0] !== '.') {
      relativePath = `./${relativePath}`;
    }
    return relativePath;
  }
  return specifier;
}

function makeHBSExplicit(specifier: string, sourceFile: AdjustFile) {
  if (/\.(hbs)|(js)|(css)$/.test(specifier)) {
    // already has a well-known explicit extension, so nevermind
    return specifier;
  }

  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.meta['auto-upgraded']) {
    return specifier;
  }

  if (pkg.meta.externals && pkg.meta.externals.includes(specifier)) {
    return specifier;
  }

  let target;
  let name = packageName(specifier);

  if (name) {
    let base = packageCache.resolve(name, pkg).root;
    target = resolve(base, specifier.replace(name, '.') + '.hbs');
  } else {
    target = resolve(dirname(sourceFile.name), specifier + '.hbs');
  }

  if (pathExistsSync(target)) {
    return specifier + '.hbs';
  }

  return specifier;
}

export default function main({ types: t }: { types: any }) {
  return {
    visitor: {
      Program: {
        enter: function(path: NodePath<Program>, state: State) {
          state.emberCLIVanillaJobs = [];
          state.generatedRequires = new Set();
          if (state.opts.extraImports) {
            addExtraImports(path, state.opts.extraImports);
          }
        },
        exit: function(_: any, state: State) {
          state.emberCLIVanillaJobs.forEach(job => job());
        },
      },
      ReferencedIdentifier(path: any, state: State) {
        if (
          path.node.name === 'require' &&
          !state.generatedRequires.has(path.node) &&
          !path.scope.hasBinding('require')
        ) {
          // any existing bare "require" should remain a *runtime* require, so
          // we rename it to window.require so that final stage packagers will
          // leave it alone.
          path.replaceWith(t.memberExpression(t.identifier('window'), path.node));
        }
        if (path.referencesImport('@embroider/core', 'require')) {
          // whereas our own explicit *build-time* require (used in the
          // generated entrypoints) gets rewritten to a plain require so that
          // final stage packagers *will* see it.
          let r = t.identifier('require');
          state.generatedRequires.add(r);
          path.replaceWith(r);
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(path: any, state: State) {
        let { opts, emberCLIVanillaJobs } = state;
        const { source } = path.node;
        if (source === null) {
          return;
        }

        // strip our own build-time-only require directive
        if (
          source.value === '@embroider/core' &&
          path.node.specifiers.length === 1 &&
          path.node.specifiers[0].imported.name === 'require'
        ) {
          emberCLIVanillaJobs.push(() => path.remove());
          return;
        }

        let file = new AdjustFile(path.hub.file.opts.filename);

        let specifier = adjustSpecifier(source.value, file, opts);
        specifier = makeHBSExplicit(specifier, file);
        if (specifier !== source.value) {
          emberCLIVanillaJobs.push(() => (source.value = specifier));
        }
      },
    },
  };
}

(main as any).baseDir = function() {
  return join(__dirname, '..');
};

function addExtraImports(path: NodePath<Program>, extraImports: Required<State['opts']>['extraImports']) {
  let counter = 0;
  for (let { absPath, target, runtimeName } of extraImports) {
    if (absPath === path.hub.file.opts.filename) {
      if (runtimeName) {
        path.node.body.unshift(amdDefine(runtimeName, counter));
        path.node.body.unshift(
          importDeclaration([importDefaultSpecifier(identifier(`a${counter++}`))], stringLiteral(target))
        );
      } else {
        path.node.body.unshift(importDeclaration([], stringLiteral(target)));
      }
    }
  }
}

function amdDefine(runtimeName: string, importCounter: number) {
  return expressionStatement(
    callExpression(memberExpression(identifier('window'), identifier('define')), [
      stringLiteral(runtimeName),
      functionExpression(null, [], blockStatement([returnStatement(identifier(`a${importCounter}`))])),
    ])
  );
}

class AdjustFile {
  constructor(public name: string) {}

  @Memoize()
  owningPackage(): Package | undefined {
    return packageCache.ownerOfFile(this.name);
  }
}
