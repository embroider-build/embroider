import { defineConfig } from 'vite';
import { embroider } from '@embroider/vite';

export default defineConfig({
  plugins: [embroider()],
});
