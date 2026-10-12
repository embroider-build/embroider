/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe } from 'vitest';
import { Preprocessor } from 'content-tag';
import { hotTransform, importedLocals } from '../src/hmr';

describe('hmr', () => {
  const preprocessor = new Preprocessor();
  const run = (src, id = '/app/src/components/foo.gjs') => hotTransform(preprocessor, src, id).then(r => r.code);

  describe('importedLocals', () => {
    it('finds default, named, renamed, and namespace imports', () => {
      expect(importedLocals(`import A, { b, c as d } from './x'`)).toEqual(['b', 'd', 'A']);
      expect(importedLocals(`import * as ns from './x'`)).toEqual(['ns']);
    });

    it('skips type-only imports', () => {
      expect(importedLocals(`import type { T } from './x'`)).toEqual([]);
      expect(importedLocals(`import A, { type T } from './x'`)).toEqual(['A']);
    });
  });

  it('wraps templates so local imports resolve to their current version', async () => {
    let out = await run(`import Greeting from './greeting.gjs';\n<template><Greeting /></template>`);
    expect(out).toContain('{{#let (__ehr_current Greeting) as |Greeting|}}<Greeting />{{/let}}');
  });

  it('does not wrap package imports or names the template does not use', async () => {
    let out = await run(
      `import { on } from '@ember/modifier';\nimport Unused from './unused.gjs';\n<template><button {{on "click" this.go}}></button></template>`
    );
    expect(out).not.toContain('{{#let');
  });

  it('registers and self-accepts a default-only component module', async () => {
    let out = await run(`<template>hi</template>`);
    expect(out).toContain('const __embroider_hmr_default__ =');
    expect(out).toContain('__ehr_define("/app/src/components/foo.gjs", __embroider_hmr_default__, __ehr_tracked);');
    expect(out).toContain('export default __embroider_hmr_default__;');
    expect(out).toContain('import.meta.hot.accept(');
  });

  it('keeps named default-exported classes as declarations', async () => {
    let out = await run(
      `import Component from '@glimmer/component';\nexport default class Foo extends Component {\n<template>hi</template>\n}\nFoo.extra = 1;`
    );
    expect(out).toMatch(/^\s*class Foo extends Component/m);
    expect(out).toContain('export default Foo;');
  });

  it('handles anonymous default-exported classes', async () => {
    let out = await run(
      `import Component from '@glimmer/component';\nexport default class extends Component {\n<template>hi</template>\n}`
    );
    expect(out).toContain('const __embroider_hmr_default__ = class extends Component');
  });

  it('does not self-accept modules with named exports', async () => {
    let out = await run(`export const x = 1;\n<template>hi</template>`);
    expect(out).toContain('__ehr_define(');
    expect(out).not.toContain('import.meta.hot.accept(');
  });

  it('renders route templates through a facade that forwards @model and @controller', async () => {
    let out = await run(`<template>{{outlet}}</template>`, '/app/src/templates/application.gjs');
    expect(out).toContain(
      '{{#let (__ehr_current __embroider_hmr_default__) as |C|}}<C @model={{@model}} @controller={{@controller}} />{{/let}}'
    );
    expect(out).toContain('export default __embroider_hmr_route_facade__;');
    expect(out).toContain('import.meta.hot.accept(');
  });

  it('supports gts', async () => {
    let out = await run(
      `import type { TOC } from '@ember/component/template-only';\nimport Greeting from './greeting.gts';\nconst Foo: TOC<{}> = <template><Greeting /></template>;\nexport default Foo;`,
      '/app/src/components/foo.gts'
    );
    expect(out).toContain('(__ehr_current Greeting)');
    expect(out).toContain('export default __embroider_hmr_default__;');
  });
});
