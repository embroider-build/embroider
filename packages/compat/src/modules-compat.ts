import Funnel from 'broccoli-funnel';
import { Tree } from 'broccoli-plugin';
import mergeTrees from 'broccoli-merge-trees';

// there is a weirder, older behavior where addons wrapped their addon tree
// output in a `modules` folder. This strips that level off if it exists,
// without discarding any other content that was not inside `modules`.

export default function modulesCompat(tree: Tree) {
  return mergeTrees([
    new Funnel(tree, { exclude: ['modules'] }),
    new Funnel(tree, { srcDir: 'modules', allowEmpty: true }),
  ]);
}
