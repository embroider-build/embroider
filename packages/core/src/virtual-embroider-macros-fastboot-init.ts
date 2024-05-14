import type { VirtualContentResult } from './virtual-content';

export function decodeEmbroiderMacrosFastbootInit(filename: string): boolean {
  return filename.includes('embroider_macros_fastboot_init.js');
}

export function renderEmbroiderMacrosFastbootInit(): VirtualContentResult {
  const src = `
    (function(){
      var key = '_embroider_macros_runtime_config';
      if (!window[key]){ window[key] = [];}
      window[key].push(function(m) {
        m.setGlobalConfig('fastboot', Object.assign({}, m.getGlobalConfig().fastboot, { isRunning: true }));
      });
    }())
  `;
  return { src, watches: [] };
}
