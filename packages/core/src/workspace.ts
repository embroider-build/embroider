export default interface Workspace {
  clearApp(): void;
  copyIntoApp(srcPath: string): void;
}
