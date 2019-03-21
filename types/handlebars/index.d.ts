declare module 'handlebars' {
  export function compile(template: string): (params: object) => string;
  export function registerHelper(name: string, fn: Function): void;
}
