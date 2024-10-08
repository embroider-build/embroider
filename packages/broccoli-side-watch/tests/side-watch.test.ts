'use strict';

import { UnwatchedDir } from 'broccoli-source';
// @ts-expect-error -- js module
import sideWatch from '../index';
import { Project } from 'scenario-tester';
import { join } from 'path';
import { createBuilder } from 'broccoli-test-helper';

async function generateProject() {
  const project = new Project('my-app', {
    files: {
      src: {
        'index.js': 'export default 123',
      },
      other: {
        'index.js': 'export default 456;',
      },
    },
  });

  await project.write();

  return project;
}

describe('broccoli-side-watch', function () {
  test('it returns existing tree without options', async function () {
    const project = await generateProject();
    const existingTree = new UnwatchedDir(join(project.baseDir, 'src'));

    const node = sideWatch(existingTree);

    expect(node).toEqual(existingTree);
  });

  test('it watches additional relative paths', async function () {
    const project = await generateProject();
    const existingTree = new UnwatchedDir(join(project.baseDir, 'src'));

    const node = sideWatch(existingTree, { watching: ['./other'], cwd: project.baseDir });
    const output = createBuilder(node);
    await output.build();

    expect(output.read()).toEqual({ 'index.js': 'export default 123' });

    const watchedNode = node
      .__broccoliGetInfo__()
      .inputNodes[1].__broccoliGetInfo__()
      .inputNodes[0].__broccoliGetInfo__();
    expect(watchedNode).toHaveProperty('watched', true);
    expect(watchedNode).toHaveProperty('sourceDirectory', join(project.baseDir, 'other'));
  });

  test('it watches additional absolute paths', async function () {
    const project = await generateProject();
    const existingTree = new UnwatchedDir(join(project.baseDir, 'src'));

    const node = sideWatch(existingTree, { watching: [join(project.baseDir, './other')] });
    const output = createBuilder(node);
    await output.build();

    expect(output.read()).toEqual({ 'index.js': 'export default 123' });

    const watchedNode = node
      .__broccoliGetInfo__()
      .inputNodes[1].__broccoliGetInfo__()
      .inputNodes[0].__broccoliGetInfo__();
    expect(watchedNode).toHaveProperty('watched', true);
    expect(watchedNode).toHaveProperty('sourceDirectory', join(project.baseDir, 'other'));
  });

  test('it watches additional package', async function () {
    const project = await generateProject();
    project.addDependency(
      new Project('some-dep', '0.0.0', {
        files: {
          'index.js': `export default 'some';`,
        },
      })
    );
    await project.write();

    const existingTree = new UnwatchedDir(join(project.baseDir, 'src'));

    const node = sideWatch(existingTree, { watching: ['some-dep'], cwd: project.baseDir });
    const output = createBuilder(node);
    await output.build();

    expect(output.read()).toEqual({ 'index.js': 'export default 123' });

    const watchedNode = node
      .__broccoliGetInfo__()
      .inputNodes[1].__broccoliGetInfo__()
      .inputNodes[0].__broccoliGetInfo__();
    expect(watchedNode).toHaveProperty('watched', true);
    expect(watchedNode).toHaveProperty('sourceDirectory', join(project.baseDir, 'node_modules/some-dep'));
  });

  test('it watches additional package with exports', async function () {
    const project = await generateProject();
    project.addDependency(
      new Project('some-dep', '0.0.0', {
        files: {
          'package.json': JSON.stringify({
            exports: {
              './*': {
                types: './declarations/*.d.ts',
                default: './dist/*.js',
              },
            },
          }),
          src: {
            'index.ts': `export default 'some';`,
          },
          dist: {
            'index.js': `export default 'some';`,
          },
          declarations: {
            'index.d.ts': `export default 'some';`,
          },
        },
      })
    );
    await project.write();

    const existingTree = new UnwatchedDir(join(project.baseDir, 'src'));

    const node = sideWatch(existingTree, { watching: ['some-dep'], cwd: project.baseDir });
    const output = createBuilder(node);
    await output.build();

    expect(output.read()).toEqual({ 'index.js': 'export default 123' });

    const watchedNode = node
      .__broccoliGetInfo__()
      .inputNodes[1].__broccoliGetInfo__()
      .inputNodes[0].__broccoliGetInfo__();
    expect(watchedNode).toHaveProperty('watched', true);
    expect(watchedNode).toHaveProperty('sourceDirectory', join(project.baseDir, 'node_modules/some-dep/dist'));
  });
});
