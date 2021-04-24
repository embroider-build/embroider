export function unwrapPlugin(params: { requireFile: string; buildUsing: string; params: any }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(params.requireFile)[params.buildUsing](params.params).plugin;
}
