import type { LoaderContext } from 'webpack';
import { Preprocessor } from 'content-tag';

// The webpack equivalent of vite's `embroider-template-tag` plugin: it runs
// content-tag over .gjs/.gts files, turning `<template>` tags into standard
// JavaScript before the result is handed to babel-loader-9.
let preprocessor: Preprocessor | undefined;

export default function templateTagLoader(this: LoaderContext<unknown>, code: string): void {
  if (!preprocessor) {
    preprocessor = new Preprocessor();
  }
  let callback = this.async();
  try {
    let result = preprocessor.process(code, { filename: this.resourcePath });
    let outCode: string;
    let map: object | undefined;
    if (typeof result === 'string') {
      outCode = result;
    } else {
      outCode = result.code;
      map = result.map ? (JSON.parse(result.map) as object) : undefined;
    }
    callback(null, outCode, map as any);
  } catch (error) {
    (error as any).type = 'Template Tag Error';
    (error as any).file = this.resourcePath;
    callback(error as Error);
  }
}
