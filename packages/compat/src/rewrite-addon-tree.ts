import buildFunnel from 'broccoli-funnel';
import mergeTrees from 'broccoli-merge-trees';
import Snitch from './snitch';
import { Node } from 'broccoli-node-api';
import { AddonMeta } from '@embroider/core';
import AddToTree from './add-to-tree';
import { moveSync, readdirSync, statSync } from 'fs-extra';
import { join, basename } from 'path';

/*
  The traditional addon and addon-test-support trees allows you to emit modules
  under any package you feel like. Which we are NOT COOL WITH.

  This transform re-captures anything you try to put into other people's
  packages, puts them back into your own, and tracks what renaming is required
  by your consumers so they can still find those things.

  Example:

  ember-qunit emits an addon-test-support tree like:

  ├── ember-qunit
  │   ├── adapter.js
  │   ├── index.js
  │   └── ...
  └── qunit
      └── index.js

  The part that is under "ember-qunit" gets handled normally, in that we can
  merge it directly into our own v2 package root so people can import the
  modules from their tests.

  But the shim under "qunit" gets moved *into* the ember-qunit package, and
  consumers of ember-qunit will get renaming from:

  import { test } from 'qunit';

  to

  import { test } from 'ember-qunit/qunit';
*/

type GetMeta = () => Partial<AddonMeta>;

export default function rewriteAddonTree(
  tree: Node,
  name: string,
  moduleName: string
): { tree: Node; getMeta: GetMeta } {
  let renamed: { [name: string]: string } = {};

  tree = new AddToTree(tree, outputPath => {
    for (let file of readdirSync(outputPath)) {
      if (!file.endsWith('.js')) {
        continue;
      }
      const filePath = join(outputPath, file);
      if (!statSync(filePath).isFile()) {
        continue;
      }
      moveSync(filePath, join(outputPath, basename(file, '.js'), 'index.js'));
    }
  });

  let goodParts = new Snitch(
    tree,
    {
      allowedPaths: new RegExp(`^${moduleName}/`),
      foundBadPaths: (badPaths: string[]) => {
        for (let badPath of badPaths) {
          renamed[badPath] = `${name}/${badPath}`;
        }
      },
    },
    {
      srcDir: moduleName,
      allowEmpty: true,
    }
  );
  let badParts = buildFunnel(tree, {
    exclude: [`${moduleName}/**`],
  });
  return {
    tree: mergeTrees([goodParts, badParts]),
    getMeta: () => ({ 'renamed-modules': renamed }),
  };
}
