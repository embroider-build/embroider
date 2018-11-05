import mergeWith from 'lodash/mergeWith';
import uniq from 'lodash/uniq';

export function mergeWithAppend(dest, ...srcs) {
  return mergeWith(dest, ...srcs, appendArrays);
}

export function mergeWithUniq(dest, ...srcs) {
  return mergeWith(dest, ...srcs, appendArraysUniq);
}

function appendArrays(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return objValue.concat(srcValue);
  }
}

function appendArraysUniq(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return uniq(objValue.concat(srcValue));
  }
}
