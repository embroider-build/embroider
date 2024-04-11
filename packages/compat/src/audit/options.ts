export type AuditOptions = FileAuditOptions | HTTPAuditOptions;

export interface FileAuditOptions {
  mode: 'file';
  debug?: boolean;
  'reuse-build'?: boolean;
  app: string;
}

export interface HTTPAuditOptions {
  mode: 'http';
  debug?: boolean;
  app: string;
  startingFrom: string[];
}
