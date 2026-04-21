import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
  input: 'idle-ninja.ts',
  output: [
    {
      file: 'dist/idle-ninja.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/idle-ninja.esm.js',
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/idle-ninja.browser.js',
      format: 'iife',
      name: 'IdleNinja', // This exposes your library on the global window.IdleNinja object in browsers
      sourcemap: true,
    },
    {
      file: 'dist/idle-ninja.browser.min.js',
      format: 'iife',
      name: 'IdleNinja',
      plugins: [terser()], // Minifies only this specific output
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false, // We let the 'tsc' step in your build script handle the .d.ts files
    }),
  ],
};
