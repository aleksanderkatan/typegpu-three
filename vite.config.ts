import typegpu from 'unplugin-typegpu/rollup';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/typegpu-three/',
  build: {
    target: 'esnext',
  },
  plugins: [typegpu()],
});
