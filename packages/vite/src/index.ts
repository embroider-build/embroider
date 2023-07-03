import type { Plugin } from 'rollup';

export function embroider(): Plugin {
  return {
    name: 'embroider',
    resolveId(source) {
      if (source === './hello') {
        return {
          id: '\0mything',
        };
      }
    },
    load(id) {
      if (id === '\0mything') {
        return "console.log('it worked')";
      }
    },
  };
}
