export interface AuditOptions {
  debug?: boolean;
}

export interface AuditBuildOptions extends AuditOptions {
  'reuse-build': boolean;
  app: string;
}
