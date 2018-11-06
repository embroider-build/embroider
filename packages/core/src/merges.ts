import mergeWith from 'lodash/mergeWith';
import uniq from 'lodash/uniq';

export function mergeWithAppend(dest: object, ...srcs: object[]) {
  return mergeWith(dest, ...srcs, appendArrays);
}

export function mergeWithUniq(dest: object, ...srcs: object[]) {
  return mergeWith(dest, ...srcs, appendArraysUniq);
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
