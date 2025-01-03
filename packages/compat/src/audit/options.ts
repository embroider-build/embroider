export interface AuditOptions {
  entrypoints: string[];
  rootURL: string;
}

export interface AuditBuildOptions extends AuditOptions {
  'reuse-build'?: boolean;
  app: string;
}
