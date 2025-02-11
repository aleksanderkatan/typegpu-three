import typegpu from 'rollup-plugin-typegpu';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/typegpu-three/',
  build: {
    target: 'esnext',
  },
  plugins: [typegpu()],
});
