/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe, vi, afterAll, afterEach } from 'vitest';
import { warnVirtualAppCss } from '../src/warn-virtual-app-css';

describe('Vite plugin warnVirtualAppCss', () => {
  const instance = warnVirtualAppCss();
  const transformHtml = instance.transformIndexHtml;

  const run = (html, context) => {
    if (transformHtml && typeof transformHtml === 'object' && 'handler' in transformHtml) {
      return transformHtml.handler(html, context);
    }
    throw new Error('No handler found');
  };

  let out = '';
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(message => (out += message + '\n'));

  afterAll(() => {
    consoleSpy.mockReset();
  });

  afterEach(() => {
    consoleSpy.mockClear();
    out = '';
  });

  it('does not change the output when @embroider/virtual/app.css is not in index.html', () => {
    const html = '<html><body><h1>Hello World</h1></body></html>';
    const result = run(html, { filename: 'index.html', server: undefined });

    expect(result).toBe(html);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not change the output when @embroider/virtual/app.css is in index.html', () => {
    const html =
      '<html><head><link rel="stylesheet" href="/@embroider/virtual/app.css"></head><body></body></html>';
    const result = run(html, { filename: 'index.html', server: undefined });

    expect(result).toBe(html);
  });

  it('prints a deprecation warning when @embroider/virtual/app.css is found in index.html', () => {
    run('<html><head><link rel="stylesheet" href="/@embroider/virtual/app.css"></head><body></body></html>', {
      filename: 'path/to/index.html',
      server: undefined,
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Referencing @embroider/virtual/app.css in path/to/index.html is deprecated.')
    );
    // recommends the Vite CSS pipeline replacement from RFC 1148
    expect(out).toContain('/app/styles/app.css');
    // links to the deprecation guide
    expect(out).toContain('https://deprecations.emberjs.com/id/broccoli-css-pipeline');
  });

  it('does not warn if EMBROIDER_WARN_VIRTUAL_APP_CSS is set to "false"', () => {
    let originalEnv = process.env.EMBROIDER_WARN_VIRTUAL_APP_CSS;

    process.env.EMBROIDER_WARN_VIRTUAL_APP_CSS = 'false';

    run('<html><head><link rel="stylesheet" href="/@embroider/virtual/app.css"></head><body></body></html>', {
      filename: 'path/to/index.html',
      server: undefined,
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(out).to.equal('');

    process.env.EMBROIDER_WARN_VIRTUAL_APP_CSS = originalEnv;
  });
});
