declare module 'source-map-url' {
  interface SrcURL {
    getFrom(code: string): string | undefined;
    existsIn(code: string): boolean;
    removeFrom(code: string): string;
    insertBefore(code: string, otherString: string): string;
  }
  const srcURL: SrcURL;
  export default srcURL;
}
