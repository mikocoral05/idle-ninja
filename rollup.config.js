import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/idle-ninja.ts',
  output: [
    {
      file: 'dist/idle-ninja.browser.js',
      format: 'umd',
      name: 'IdleNinja', // This becomes the global window.IdleNinja variable
      sourcemap: true,
    },
    {
      file: 'dist/idle-ninja.browser.min.js',
      format: 'umd',
      name: 'IdleNinja',
      sourcemap: true,
      plugins: [terser()], // Minifies this specific output
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      // Override TS config to preserve ES modules for Rollup to bundle effectively
      module: 'ESNext',
      declaration: false, // We already build declarations via standard tsc
    }),
  ],
};
