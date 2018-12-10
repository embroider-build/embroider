import 'qunit';
import MultiTreeDiff from '../src/multi-tree-diff';
import { Entry, Operation } from 'fs-tree-diff';
import { join } from 'path';
import cloneDeep from 'lodash/cloneDeep';

const { test } = QUnit;

// https://github.com/joliss/node-walk-sync/pull/38
function buggyDate(timestamp: number) {
  return timestamp as unknown as Date;
}

QUnit.module('tracked-merge-dirs', function() {
  test('it combines files from all inDirs', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a,b,c]);
    let { ops, sources } = t.update();

    assert.deepEqual(fileOps(ops), [
      ['create', 'alpha'],
      ['mkdir', 'beta'],
      ['create', 'beta/x'],
      ['create', 'charlie'],
      ['create', 'tomster'],
    ]);

    assert.equal(sources.get('alpha'), 0);
    assert.equal(sources.get('beta'), 1);
    assert.equal(sources.get('beta/x'), 1);
    assert.equal(sources.get('charlie'), 2);
    assert.equal(sources.get('tomster'), 0);
  });

  test('it prioritizes files from later dirs', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let c = new MockTree(['charlie', 'alpha']);

    let t = new MultiTreeDiff([a,c]);
    let { ops, sources } = t.update();

    assert.deepEqual(fileOps(ops), [
      ['create', 'alpha'],
      ['create', 'charlie'],
      ['create', 'tomster'],
    ]);

    assert.equal(sources.get('alpha'), 1);
    assert.equal(sources.get('charlie'), 1);
    assert.equal(sources.get('tomster'), 0);
  });

  test('it emits nothing when stable', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a,b,c]);
    t.update();
    let { ops } = t.update();
    assert.deepEqual(fileOps(ops), []);
  });

  test('it emits a changed file', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a,b,c]);
    t.update();
    dirty(a.entries[0]);
    let { ops, sources } = t.update();
    assert.deepEqual(fileOps(ops), [
      ['change', 'alpha']
    ]);
    assert.equal(sources.get('alpha'), 0);
  });

  test('it falls back to earlier source at deletion', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let c = new MockTree(['charlie', 'alpha']);

    let t = new MultiTreeDiff([a,c]);

    let result = t.update();
    assert.equal(result.sources.get('alpha'), 1);

    c.entries.splice(0, 1);

    result = t.update();
    assert.deepEqual(fileOps(result.ops), [
      ['change', 'alpha'],
    ]);
    assert.equal(result.sources.get('alpha'), 0);
  });

  test('it switches to later source at creation', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a,b]);

    let result = t.update();
    assert.equal(result.sources.get('alpha'), 0);

    b.entries.push({
      relativePath: 'alpha',
      mode: 33188,
      size: 1000,
      mtime: buggyDate(Date.now()),
      isDirectory: () => false
    });

    result = t.update();
    assert.deepEqual(fileOps(result.ops), [
      ['change', 'alpha'],
    ]);
    assert.equal(result.sources.get('alpha'), 1);
  });

  test('it hides changes in occluded files', function(assert) {
    let a = new MockTree(['alpha']);
    let b = new MockTree(['alpha']);

    let t = new MultiTreeDiff([a,b]);
    t.update();
    dirty(a.entries[0]);
    let { ops } = t.update();
    assert.deepEqual(fileOps(ops), []);
  });

  test('it respects mayChange', function(assert) {
    let a = new MockTree(['alpha', 'tomster']);
    a.mayChange = false;
    let t = new MultiTreeDiff([a]);
    t.update();
    dirty(a.entries[0]);
    let { ops } = t.update();
    assert.deepEqual(fileOps(ops), []);
  });

});

class MockTree {
  entries: Entry[];

  constructor(structure: any){
    this.entries = [...MockTree.walk([], structure)];
  }

  static * walk(breadcrumbs: string[], structure: any): IterableIterator<Entry> {
    if (Array.isArray(structure)) {
      let expanded: any = {};
      for (let name of structure) {
        expanded[name] = true;
      }
      structure = expanded;
    }

    let names = Object.keys(structure).sort();
    for (let name of names) {
      let value = structure[name];
      if (typeof value === 'object') {
        yield {
          relativePath: join(...breadcrumbs, name),
          mode: 33188,
          size: 1000,
          mtime: buggyDate(Date.now()),
          isDirectory: () => true
        };
        yield * this.walk([...breadcrumbs, name], value);
      } else {
        yield {
          relativePath: join(...breadcrumbs, name),
          mode: 33188,
          size: 1000,
          mtime: buggyDate(Date.now()),
          isDirectory: () => false
        };
      }
    }
  }

  walk(): Entry[] {
    return cloneDeep(this.entries);
  }

  mayChange = true;
}

function dirty(entry: Entry) {
  entry.mtime = buggyDate(entry.mtime as unknown as number + 1000);
}

function fileOps(operations: Operation[]) {
  return operations.map(o => [o[0], o[1]]);
}
