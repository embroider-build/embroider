import getPackageName from './package-name';
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
import Package, { V2Package } from './package';
import { pathExistsSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { Memoize } from 'typescript-memoize';
import { compile } from './js-handlebars';

interface State {
  emberCLIVanillaJobs: Function[];
  generatedRequires: Set<Node>;
  opts: {
    rename: {
      [fromName: string]: string;
    };
    extraImports: {
      absPath: string;
      target: string;
      runtimeName?: string;
    }[];
    externalsDir: string;
  };
}

export type Options = State['opts'];

const packageCache = PackageCache.shared('embroider-stage3');

function adjustSpecifier(specifier: string, sourceFile: AdjustFile, opts: State['opts']) {
  let packageName = getPackageName(specifier);
  if (!packageName) {
    return specifier;
  }

  if (opts.rename[packageName]) {
    return specifier.replace(packageName, opts.rename[packageName]);
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
    let relativePath = relative(dirname(sourceFile.name), fullPath);
    if (relativePath[0] !== '.') {
      relativePath = `./${relativePath}`;
    }
    return relativePath;
  }
  return specifier;
}

function isExternal(packageName: string, fromPkg: V2Package): boolean {
  if (fromPkg.isV2Addon() && fromPkg.meta['externals'] && fromPkg.meta['externals'].includes(packageName)) {
    return true;
  }

  // we're being strict, packages authored in v2 need to list their own
  // externals, we won't resolve for them.
  if (!fromPkg.meta['auto-upgraded']) {
    return false;
  }

  try {
    let dep = packageCache.resolve(packageName, fromPkg);
    if (!dep.isEmberPackage() && !fromPkg.hasDependency('ember-auto-import')) {
      return true;
    }
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
    return true;
  }

  return false;
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

  if (isExternal(packageName, pkg)) {
    let target = join(opts.externalsDir, specifier + '.js');
    ensureDirSync(dirname(target));
    writeFileSync(
      target,
      externalTemplate({
        runtimeName: specifier,
      })
    );
    let relativePath = relative(dirname(sourceFile.name), target.slice(0, -3));
    if (relativePath[0] !== '.') {
      relativePath = `./${relativePath}`;
    }
    return relativePath;
  } else {
    if (!pkg.meta['auto-upgraded'] && !pkg.hasDependency(packageName)) {
      throw new Error(
        `${pkg.name} is trying to import from ${packageName} but that is not one of its explicit dependencies`
      );
    }
    return specifier;
  }
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
        enter: function(path: NodePath<Program>, state: State) {
          state.emberCLIVanillaJobs = [];
          state.generatedRequires = new Set();
          addExtraImports(path, state.opts.extraImports);
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
        specifier = handleExternal(specifier, file, opts);
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
