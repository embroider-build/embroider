export default function literal(value: any, builders: any): any {
  if (typeof value === 'number') {
    return builders.number(value);
  }
  if (typeof value === 'boolean') {
    return builders.boolean(value);
  }
  if (typeof value === 'string') {
    return builders.string(value);
  }
  if (value === null) {
    return builders.null();
  }
  if (value === undefined) {
    return builders.undefined();
  }
  if (Array.isArray(value)) {
    return builders.sexpr('array', value.map(element => literal(element, builders)));
  }
  if (typeof value === 'object') {
    return builders.sexpr('hash', undefined, builders.hash(Object.entries(value).map(([k,v]) => builders.pair(k,literal(v, builders)))));
  }

  throw new Error(`don't know how to emit a literal form of value ${value}`);
}
