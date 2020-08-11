import getPackageName from './package-name';
import { join, dirname, resolve } from 'path';
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
  isStringLiteral,
  isArrayExpression,
  isFunction,
  CallExpression,
  StringLiteral,
  ArrayExpression,
  ExportNamedDeclaration,
  ImportDeclaration,
  ExportAllDeclaration,
} from '@babel/types';
import PackageCache from './package-cache';
import Package, { V2Package } from './package';
import { outputFileSync } from 'fs-extra';
import { Memoize } from 'typescript-memoize';
import { compile } from './js-handlebars';
import { explicitRelative } from './paths';

interface State {
  emberCLIVanillaJobs: Function[];
  adjustFile: AdjustFile;
  opts: {
    renamePackages: {
      [fromName: string]: string;
    };
    renameModules: {
      [fromName: string]: string;
    };
    extraImports: {
      absPath: string;
      target: string;
      runtimeName?: string;
    }[];
    externalsDir: string;
    activeAddons: {
      [packageName: string]: string;
    };
    relocatedFiles: { [relativePath: string]: string };
    resolvableExtensions: string[];
  };
}

export type Options = State['opts'];

const packageCache = PackageCache.shared('embroider-stage3');

type DefineExpressionPath = NodePath<CallExpression> & {
  node: CallExpression & {
    arguments: [StringLiteral, ArrayExpression, Function];
  };
};

export function isDefineExpression(path: NodePath<any>): path is DefineExpressionPath {
  // should we allow nested defines, or stop at the top level?
  if (!path.isCallExpression() || path.node.callee.type !== 'Identifier' || path.node.callee.name !== 'define') {
    return false;
  }

  const args = path.node.arguments;

  // only match define with 3 arguments define(name: string, deps: string[], cb: Function);
  return (
    Array.isArray(args) &&
    args.length === 3 &&
    isStringLiteral(args[0]) &&
    isArrayExpression(args[1]) &&
    isFunction(args[2])
  );
}

function adjustSpecifier(specifier: string, file: AdjustFile, opts: Options) {
  specifier = handleRenaming(specifier, file, opts);
  specifier = handleExternal(specifier, file, opts);
  if (file.isRelocated) {
    specifier = handleRelocation(specifier, file);
  }
  return specifier;
}

function handleRenaming(specifier: string, sourceFile: AdjustFile, opts: State['opts']) {
  let packageName = getPackageName(specifier);
  if (!packageName) {
    return specifier;
  }

  for (let [candidate, replacement] of Object.entries(opts.renameModules)) {
    if (candidate === specifier) {
      return replacement;
    }
    for (let extension of opts.resolvableExtensions) {
      if (candidate === specifier + '/index' + extension) {
        return replacement;
      }
      if (candidate === specifier + extension) {
        return replacement;
      }
    }
  }

  if (opts.renamePackages[packageName]) {
    return specifier.replace(packageName, opts.renamePackages[packageName]);
  }

  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.isV2Ember()) {
    return specifier;
  }

  if (pkg.meta['auto-upgraded'] && pkg.name === packageName) {
    // we found a self-import, make it relative. Only auto-upgraded packages get
    // this help, v2 packages are natively supposed to use relative imports for
    // their own modules, and we want to push them all to do that correctly.
    let fullPath = specifier.replace(packageName, pkg.root);
    return explicitRelative(dirname(sourceFile.name), fullPath);
  }
  return specifier;
}

function isExplicitlyExternal(specifier: string, fromPkg: V2Package): boolean {
  return Boolean(fromPkg.isV2Addon() && fromPkg.meta['externals'] && fromPkg.meta['externals'].includes(specifier));
}

function isResolvable(packageName: string, fromPkg: V2Package): boolean {
  try {
    let dep = packageCache.resolve(packageName, fromPkg);
    if (!dep.isEmberPackage() && !fromPkg.hasDependency('ember-auto-import')) {
      return false;
    }
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    return false;
  }
  return true;
}

const externalTemplate = compile(`
{{#if (eq runtimeName "require")}}
const m = window.requirejs;
{{else}}
const m = window.require("{{{js-string-escape runtimeName}}}");
{{/if}}
{{!-
  There are plenty of hand-written AMD defines floating around
  that lack this, and they will break when other build systems
  encounter them.

  As far as I can tell, Ember's loader was already treating this
  case as a module, so in theory we aren't breaking anything by
  marking it as such when other packagers come looking.

  todo: get review on this part.
-}}
if (m.default && !m.__esModule) {
  m.__esModule = true;
}
module.exports = m;
`) as (params: { runtimeName: string }) => string;

function handleExternal(specifier: string, sourceFile: AdjustFile, opts: Options): string {
  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.isV2Ember()) {
    return specifier;
  }

  let packageName = getPackageName(specifier);
  if (!packageName) {
    // This is a relative import. We don't automatically externalize those
    // because it's rare, and by keeping them static we give better errors. But
    // we do allow them to be explicitly externalized by the package author (or
    // a compat adapter). In the metadata, they would be listed in
    // package-relative form, so we need to convert this specifier to that.
    let absoluteSpecifier = resolve(dirname(sourceFile.name), specifier);
    let packageRelativeSpecifier = explicitRelative(pkg.root, absoluteSpecifier);
    if (isExplicitlyExternal(packageRelativeSpecifier, pkg)) {
      let publicSpecifier = absoluteSpecifier.replace(pkg.root, pkg.name);
      return makeExternal(publicSpecifier, sourceFile, opts);
    } else {
      return specifier;
    }
  }

  // absolute package imports can also be explicitly external based on their
  // full specifier name
  if (isExplicitlyExternal(specifier, pkg)) {
    return makeExternal(specifier, sourceFile, opts);
  }

  if (isResolvable(packageName, pkg)) {
    if (!pkg.meta['auto-upgraded'] && !pkg.hasDependency(packageName)) {
      throw new Error(
        `${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`
      );
    }
    return specifier;
  }

  // we're being strict, packages authored in v2 need to list their own
  // externals, we won't resolve for them.
  if (!pkg.meta['auto-upgraded']) {
    return specifier;
  }

  if (opts.activeAddons[packageName]) {
    return explicitRelative(dirname(sourceFile.name), specifier.replace(packageName, opts.activeAddons[packageName]));
  } else {
    return makeExternal(specifier, sourceFile, opts);
  }
}

function makeExternal(specifier: string, sourceFile: AdjustFile, opts: Options): string {
  let target = join(opts.externalsDir, specifier + '.js');
  outputFileSync(
    target,
    externalTemplate({
      runtimeName: specifier,
    })
  );
  return explicitRelative(dirname(sourceFile.name), target.slice(0, -3));
}

function handleRelocation(specifier: string, sourceFile: AdjustFile) {
  let packageName = getPackageName(specifier);
  if (!packageName) {
    return specifier;
  }
  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.isV2Ember()) {
    return specifier;
  }
  let targetPkg = packageCache.resolve(packageName, pkg);
  return explicitRelative(dirname(sourceFile.name), specifier.replace(packageName, targetPkg.root));
}

export default function main() {
  return {
    visitor: {
      Program: {
        enter(path: NodePath<Program>, state: State) {
          state.emberCLIVanillaJobs = [];
          state.adjustFile = new AdjustFile(path.hub.file.opts.filename, state.opts.relocatedFiles);
          addExtraImports(path, state.opts.extraImports);
        },
        exit(_: any, state: State) {
          state.emberCLIVanillaJobs.forEach(job => job());
        },
      },
      CallExpression(path: NodePath<CallExpression>, state: State) {
        // Should/can we make this early exit when the first define was found?
        if (!isDefineExpression(path)) {
          return;
        }

        let pkg = state.adjustFile.owningPackage();
        if (pkg && pkg.isV2Ember() && !pkg.meta['auto-upgraded']) {
          throw new Error(
            `The file ${state.adjustFile.originalFile} in package ${
              pkg.name
            } tried to use AMD define. Native V2 Ember addons are forbidden from using AMD define, they must use ECMA export only.`
          );
        }

        let { opts } = state;

        const dependencies = path.node.arguments[1];

        const specifiers = dependencies.elements.slice();
        specifiers.push(path.node.arguments[0]);

        for (let source of specifiers) {
          if (!source) {
            continue;
          }

          if (source.type !== 'StringLiteral') {
            throw path.buildCodeFrameError(`expected only string literal arguments`);
          }

          if (source.value === 'exports' || source.value === 'require') {
            // skip "special" AMD dependencies
            continue;
          }

          let specifier = adjustSpecifier(source.value, state.adjustFile, opts);

          if (specifier !== source.value) {
            source.value = specifier;
          }
        }
      },
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(
        path: NodePath<ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration>,
        state: State
      ) {
        let { opts, emberCLIVanillaJobs } = state;
        const { source } = path.node;
        if (source === null) {
          return;
        }

        let specifier = adjustSpecifier(source.value, state.adjustFile, opts);
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
  readonly originalFile: string;

  constructor(public name: string, relocatedFiles: Options['relocatedFiles']) {
    this.originalFile = relocatedFiles[name] || name;
  }

  get isRelocated() {
    return this.originalFile !== this.name;
  }

  @Memoize()
  owningPackage(): Package | undefined {
    return packageCache.ownerOfFile(this.originalFile);
  }
}
