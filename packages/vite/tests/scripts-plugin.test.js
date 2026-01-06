import { describe, it, onTestFinished, vi, expect } from "vitest"
import { build } from 'vite'
import { resolve } from 'node:path'

const { minify } = require('html-minifier-terser');

import { classicEmberSupport } from '../src/classic-ember-support';
import { readFile } from "node:fs/promises"

vi.mock('../src/build', () => {
  return {
    compatPrebuild: () => ({})
  }
})

vi.mock('@embroider/core', async (importOriginal) => {
  return {
    ...await importOriginal(),
    // this will only affect "foo" outside of the original module
    ResolverLoader: class FakeResolverLoader {
      get resolver() {
        return {
          options: {
            engines: []
          }
        }
      }
    }
  }
})


describe("@embroider/vite scripts plugin", () => {
  it("should do something", async () => {

    process.env.EMBROIDER_WORKING_DIRECTORY = resolve(__dirname, 'fixtures/scripts/.embroider');
    onTestFinished(() => { delete process.env.EMBROIDER_WORKING_DIRECTORY})
    let counter = 0
    await build({
      root: resolve(__dirname, 'fixtures/scripts'),
      logLevel: 'warn',
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, 'fixtures/scripts/index.html'),
          },
        },
      },
      plugins: [
        classicEmberSupport(),
      ],
    });

    const result = await readFile(resolve(__dirname, 'fixtures/scripts/dist/index.html'), 'utf-8');

    expect(await minify(result, {collapseWhitespace: true})).toMatchInlineSnapshot(`"<!DOCTYPE html><html><head><meta name="head" content="this is my meta block"><meta name="head-footer" content="this is my meta block"></head><body><h1>body</h1><h1>body footer</h1></body></html>"`)
  })
})

