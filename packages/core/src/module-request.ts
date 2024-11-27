// This is generic because different build systems have different ways of
// representing a found module, and we just pass those values through.
export type Resolution<T = unknown, E = unknown> =
  | { type: 'found'; filename: string; isVirtual: boolean; result: T }

  // used for requests that are special and don't represent real files that
  // embroider can possibly do anything custom with.
  //
  // the motivating use case for introducing this is Vite's depscan which marks
  // almost everything as "external" as a way to tell esbuild to stop traversing
  // once it has been seen the first time.
  | { type: 'ignored'; result: T }

  // the important thing about this Resolution is that embroider should do its
  // fallback behaviors here.
  | { type: 'not_found'; err: E };

export interface ModuleRequest<Res extends Resolution = Resolution> {
  readonly specifier: string;
  readonly fromFile: string;
  readonly isVirtual: boolean;
  readonly meta: Record<string, unknown> | undefined;
  readonly debugType: string;
  readonly isNotFound: boolean;
  readonly resolvedTo: Res | undefined;
  alias(newSpecifier: string): this;
  rehome(newFromFile: string): this;
  virtualize(virtualFilename: string): this;
  withMeta(meta: Record<string, any> | undefined): this;
  notFound(): this;
  defaultResolve(): Promise<Res>;
  resolveTo(resolution: Res): this;
}
