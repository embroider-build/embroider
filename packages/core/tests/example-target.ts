export = function exampleTarget(_babel: any, params: any) {
  if (params) {
    return `this is the example target with params=${params}`;
  } else {
    return `this is the example target with no params`;
  }
};
