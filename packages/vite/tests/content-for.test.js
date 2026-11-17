import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { contentFor } from '../src/content-for';

describe('@embroider/vite content-for plugin', () => {
  const html = '<html><head>{{content-for "head"}}</head><body>{{content-for \'body\'}}</body></html>';

  beforeEach(() => {
    process.env.EMBROIDER_WORKING_DIRECTORY = resolve(__dirname, 'fixtures/scripts/.embroider');
  });

  afterEach(() => {
    delete process.env.EMBROIDER_WORKING_DIRECTORY;
  });

  it('replaces the content-for placeholders of a page listed in content-for.json', () => {
    const result = contentFor().transformIndexHtml(html, { path: '/index.html' });

    expect(result).toBe(
      '<html><head><meta name="head" content="this is my meta block" /></head><body><h1>body</h1></body></html>'
    );
  });

  it('does nothing for a page not listed in content-for.json', () => {
    const result = contentFor().transformIndexHtml(html, { path: '/@fs/some/other/page.html' });

    expect(result).toBe(html);
  });
});
