import { describeExports } from '../src/describe-exports';

function names(code: string): string[] {
  return [...describeExports(code, { configFile: false }).names].sort();
}

describe('describeExports', () => {
  test('declaration exports', () => {
    expect(names(`export const a = 1, b = 2;`)).toEqual(['a', 'b']);
    expect(names(`export function f() {}`)).toEqual(['f']);
    expect(names(`export class C {}`)).toEqual(['C']);
  });

  test('specifier exports', () => {
    expect(names(`const x = 1; export { x };`)).toEqual(['x']);
    expect(names(`const x = 1; export { x as y };`)).toEqual(['y']);
    expect(names(`const x = 1; export { x as 'string name' };`)).toEqual(['string name']);
    expect(names(`export * as ns from 'other';`)).toEqual(['ns']);
  });

  test('default export', () => {
    expect(names(`export default 42;`)).toEqual(['default']);
  });

  test('ignores non-exports', () => {
    expect(names(`const a = 1; function f() {} export * from 'other';`)).toEqual([]);
  });
});
