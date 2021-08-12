declare module 'heimdalljs' {
  export interface HeimdallOptions {
    name: string;
  }
  export interface HeimdallNode {
    remove(): void;
  }
  export interface HeimdallCookie {
    stop(): void;
  }
  const heimdall: {
    current: HeimdallNode;
    start(HeimdallOptions): HeimdallCookie;
  };
  export default heimdall;
}
