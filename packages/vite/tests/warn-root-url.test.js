/* eslint-disable-next-line import/no-extraneous-dependencies */
import { it, expect, describe, vi, afterAll, afterEach } from 'vitest';
import { warnRootUrl } from '../src/warn-root-url';

describe('Vite plugin warnRootUrl', () => {
  const instance = warnRootUrl();
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

  it('does not change the output if {{rootURL}} is not in index.html', () => {
    const html = '<html><body><h1>Hello World</h1></body></html>';
    const result = run(html, { filename: 'index.html', server: undefined });

    expect(result).toBe(html);
  });

  it('does not change the output if {{rootURL}} is in index.html', () => {
    const html = '<html><body><h1>Hello World</h1></body></html>';
    const result = run(html, { filename: 'index.html', server: undefined });

    expect(result).toBe(html);
  });

  it('prints a warning to the console if {{rootURL}} or {{ rootURL }} is found in index.html', () => {
    run('<html><body><h1>{{rootURL}}</h1>{{ rootURL }}</body></html>', { filename: 'index.html', server: undefined });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Using {{rootURL}} in index.html is no longer supported.')
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('You need to update 2 occurence(s)'));
  });

  it('prints a more specific warning to the console if {{rootURL}} is found in attributes in index.html', () => {
    run(
      `<html>
<head>
  <link href="{{ rootURL }}">
</head>
<body>
  <h1>{{rootURL}}</h1>
  {{ rootURL }}
  <script src="{{rootURL}}"></script>
</body>
</html>
`,
      { filename: 'path/to/index.html', server: undefined }
    );

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
    expect(out).toMatchInlineSnapshot(`
      "
      WARNING
      Using {{rootURL}} in path/to/index.html is no longer supported.

      You need to update 2 attribute(s):
        L3:9 <link href="{{ rootURL }}">
        L8:11 <script src="{{rootURL}}"></script>
      You also need to update 2 other occurence(s) elsewhere in the same file.

      To disable this warning set environment variable "EMBROIDER_WARN_ROOT_URL" to "false"

      "
    `);
  });

  it('does not warn if EMBROIDER_WARN_ROOT_URL is set to "false"', () => {
    let originalEnv = process.env.EMBROIDER_WARN_ROOT_URL;

    process.env.EMBROIDER_WARN_ROOT_URL = 'false';

    run(
      `<html>
<head>
  <link href="{{ rootURL }}">
</head>
<body>
  <h1>{{rootURL}}</h1>
  {{ rootURL }}
  <script src="{{rootURL}}"></script>
</body>
</html>
`,
      { filename: 'path/to/index.html', server: undefined }
    );

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(out).to.equal('');

    process.env.EMBROIDER_WARN_ROOT_URL = originalEnv;
  });
});
