import mergeWith from 'lodash/mergeWith';
import uniq from 'lodash/uniq';

export function mergeWithAppend(dest: object, srcs: object[]) {
  for (const src of srcs) {
    mergeWith(dest, src, appendArrays);
  }
  return dest;
}

export function mergeWithUniq(dest: object, srcs: object[]) {
  for (const src of srcs) {
    mergeWith(dest, src, appendArraysUniq);
  }
  return dest;
}

function appendArrays(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function appendArraysUniq(objValue: any, srcValue: any) {
  if (Array.isArray(objValue)) {
    return uniq(objValue.concat(srcValue));
  }
}
