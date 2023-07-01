import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const {
    default: { default: embroiderVitePlugin },
  } = await import('@embroider/vite');
  debugger;
  return { plugins: [embroiderVitePlugin()] };
});
