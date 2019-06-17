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
} from '@babel/types';
import PackageCache from './package-cache';
import Package, { V2Package } from './package';
import { pathExistsSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { Memoize } from 'typescript-memoize';
import { compile } from './js-handlebars';
import { explicitRelative } from './paths';

interface State {
  emberCLIVanillaJobs: Function[];
  generatedRequires: Set<Node>;
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
  };
}

export type Options = State['opts'];

const packageCache = PackageCache.shared('embroider-stage3');
export function isDefineExpression(t: any, path: any) {
  const { node } = path;
  // should we allow nested defines, or stop at the top level?
  if (!path.isCallExpression() || node.callee.name !== 'define') {
    return false;
  }

  const args = node.arguments;

  // only match define with 3 arguments define(name: string, deps: string[], cb: Function);
  return (
    Array.isArray(args) &&
    args.length === 3 &&
    t.isStringLiteral(args[0]) &&
    t.isArrayExpression(args[1]) &&
    t.isFunction(args[2])
  );
}

function adjustSpecifier(specifier: string, file: AdjustFile, opts: Options) {
  specifier = handleRenaming(specifier, file, opts);
  specifier = handleExternal(specifier, file, opts);
  if (file.isRelocated) {
    specifier = handleRelocation(specifier, file);
  }
  specifier = makeHBSExplicit(specifier, file);
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
    if (candidate === specifier + '/index.js') {
      return replacement;
    }
    if (candidate === specifier + '.js') {
      return replacement;
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
    // this help, v2 packages are natively supposed to use explicit hbs
    // extensions, and we want to push them all to do that correctly.
    let fullPath = specifier.replace(packageName, pkg.root);
    return explicitRelative(dirname(sourceFile.name), fullPath);
  }
  return specifier;
}

function isExplicitlyExternal(packageName: string, fromPkg: V2Package): boolean {
  return Boolean(fromPkg.isV2Addon() && fromPkg.meta['externals'] && fromPkg.meta['externals'].includes(packageName));
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
const m = window.require;
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
  let packageName = getPackageName(specifier);
  if (!packageName) {
    // must have been relative, we only care about absolute imports here
    return specifier;
  }

  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.isV2Ember()) {
    return specifier;
  }

  if (isExplicitlyExternal(packageName, pkg)) {
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
  ensureDirSync(dirname(target));
  writeFileSync(
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

function makeHBSExplicit(specifier: string, sourceFile: AdjustFile) {
  if (/\.(hbs)|(js)|(css)$/.test(specifier)) {
    // already has a well-known explicit extension, so nevermind
    return specifier;
  }

  // our own externals by definition aren't things we can find on disk, so no
  // point trying
  if (specifier.startsWith('@embroider/externals/')) {
    return specifier;
  }

  let pkg = sourceFile.owningPackage();
  if (!pkg || !pkg.isV2Ember() || !pkg.meta['auto-upgraded']) {
    // only auto-upgraded packages get this adjustment, native v2 packages are
    // supposed to already say '.hbs' explicitly whenever they import a
    // template.
    return specifier;
  }

  let target;
  let packageName = getPackageName(specifier);

  if (packageName) {
    let base = packageCache.resolve(packageName, pkg).root;
    target = resolve(base, specifier.replace(packageName, '.') + '.hbs');
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
        enter(path: NodePath<Program>, state: State) {
          state.emberCLIVanillaJobs = [];
          state.generatedRequires = new Set();
          state.adjustFile = new AdjustFile(path.hub.file.opts.filename, state.opts.relocatedFiles);
          addExtraImports(path, state.opts.extraImports);
        },
        exit(_: any, state: State) {
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
      CallExpression(path: any, state: State) {
        // Should/can we make this early exit when the first define was found?
        if (isDefineExpression(t, path) === false) {
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
          if (source.value === 'exports' || source.value === 'require') {
            // skip "special" AMD dependencies
            continue;
          }
          t.assertStringLiteral(source);

          let specifier = adjustSpecifier(source.value, state.adjustFile, opts);

          if (specifier !== source.value) {
            source.value = specifier;
          }
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
