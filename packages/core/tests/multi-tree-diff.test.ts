import MultiTreeDiff from '../src/multi-tree-diff';
import { Entry, Patch } from 'fs-tree-diff';
import { join, sep } from 'path';
import cloneDeep from 'lodash/cloneDeep';

describe('tracked-merge-dirs', () => {
  test('it combines files from all inDirs', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a, b, c]);
    let { ops, sources } = t.update();

    expect(fileOps(ops)).toEqual([
      ['create', 'alpha'],
      ['mkdir', 'beta'],
      ['create', 'beta/x'.split('/').join(sep)],
      ['create', 'charlie'],
      ['create', 'tomster'],
    ]);

    expect(sources.get('alpha')).toBe(0);
    expect(sources.get('beta')).toBe(1);
    expect(sources.get(`beta${sep}x`)).toBe(1);
    expect(sources.get('charlie')).toBe(2);
    expect(sources.get('tomster')).toBe(0);
  });

  test('it prioritizes files from later dirs', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let c = new MockTree(['charlie', 'alpha']);

    let t = new MultiTreeDiff([a, c]);
    let { ops, sources } = t.update();

    expect(fileOps(ops)).toEqual([['create', 'alpha'], ['create', 'charlie'], ['create', 'tomster']]);

    expect(sources.get('alpha')).toBe(1);
    expect(sources.get('charlie')).toBe(1);
    expect(sources.get('tomster')).toBe(0);
  });

  test('it emits nothing when stable', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a, b, c]);
    t.update();
    let { ops } = t.update();
    expect(fileOps(ops)).toEqual([]);
  });

  test('it emits a changed file', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree({ beta: ['x'] });
    let c = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a, b, c]);
    t.update();
    dirty(a.entries[0]);
    let { ops, sources } = t.update();
    expect(fileOps(ops)).toEqual([['change', 'alpha']]);
    expect(sources.get('alpha')).toBe(0);
  });

  test('it falls back to earlier source at deletion', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let c = new MockTree(['charlie', 'alpha']);

    let t = new MultiTreeDiff([a, c]);

    let result = t.update();
    expect(result.sources.get('alpha')).toBe(1);

    c.entries.splice(0, 1);

    result = t.update();
    expect(fileOps(result.ops)).toEqual([['change', 'alpha']]);
    expect(result.sources.get('alpha')).toBe(0);
  });

  test('it switches to later source at creation', () => {
    let a = new MockTree(['alpha', 'tomster']);
    let b = new MockTree(['charlie']);

    let t = new MultiTreeDiff([a, b]);

    let result = t.update();
    expect(result.sources.get('alpha')).toBe(0);

    b.entries.push({
      relativePath: 'alpha',
      mode: 33188,
      size: 1000,
      mtime: Date.now(),
      isDirectory: () => false,
    });

    result = t.update();
    expect(fileOps(result.ops)).toEqual([['change', 'alpha']]);
    expect(result.sources.get('alpha')).toBe(1);
  });

  test('it hides changes in occluded files', () => {
    let a = new MockTree(['alpha']);
    let b = new MockTree(['alpha']);

    let t = new MultiTreeDiff([a, b]);
    t.update();
    dirty(a.entries[0]);
    let { ops } = t.update();
    expect(fileOps(ops)).toEqual([]);
  });

  test('it respects mayChange', () => {
    let a = new MockTree(['alpha', 'tomster']);
    a.mayChange = false;
    let t = new MultiTreeDiff([a]);
    t.update();
    dirty(a.entries[0]);
    let { ops } = t.update();
    expect(fileOps(ops)).toEqual([]);
  });
});

class MockTree {
  entries: Entry[];

  constructor(structure: any) {
    this.entries = [...MockTree.walk([], structure)];
  }

  static *walk(breadcrumbs: string[], structure: any): IterableIterator<Entry> {
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
          mtime: Date.now(),
          isDirectory: () => true,
        };
        yield* this.walk([...breadcrumbs, name], value);
      } else {
        yield {
          relativePath: join(...breadcrumbs, name),
          mode: 33188,
          size: 1000,
          mtime: Date.now(),
          isDirectory: () => false,
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
  if (entry.mtime) {
    entry.mtime = +entry.mtime + 1000;
  }
}

function fileOps(operations: Patch) {
  return operations.map(o => [o[0], o[1]]);
}
