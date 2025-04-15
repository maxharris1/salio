import glsl from 'vite-plugin-glsl';

export default {
  base: '/',
  build: {
    sourcemap: true
  },
  plugins: [glsl()]
} 