export interface Plugins {
  ast?: unknown[];
}

export interface AST {
  _deliberatelyOpaque: 'AST';
}

export interface PreprocessOptions {
  contents: string;
  moduleName: string;
  plugins?: Plugins;
  filename?: string;

  parseOptions?: {
    srcName?: string;
    ignoreStandalone?: boolean;
  };

  // added in Ember 3.17 (@glimmer/syntax@0.40.2)
  mode?: 'codemod' | 'precompile';

  // added in Ember 3.25
  strictMode?: boolean;
  locals?: string[];
}

export interface PrinterOptions {
  entityEncoding?: 'transformed' | 'raw';
}

// This just reflects the API we're extracting from ember-template-compiler.js,
// plus a cache key that lets us know when the underlying source has remained
// stable.
export interface GlimmerSyntax {
  preprocess(html: string, options?: PreprocessOptions): AST;
  print(ast: AST, options?: PrinterOptions): string;
  defaultOptions(options: PreprocessOptions): PreprocessOptions;
  precompile(
    templateContents: string,
    options: {
      contents: string;
      moduleName: string;
      filename: string;
      plugins?: any;
      parseOptions?: {
        srcName?: string;
      };
    }
  ): string;
  _Ember: { FEATURES: any; ENV: any };
  cacheKey: string;
}
