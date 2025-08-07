import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'dist/esm/index.js',
  plugins: [
    nodeResolve({
      // Resolve relative imports and directory imports (e.g., './shared/logger' -> './shared/logger/index.js')
      preferBuiltins: false,
      // Support for resolving from node_modules if needed
      exportConditions: ['node', 'default', 'module', 'import'],
    })
  ],
  output: [
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorAdaptyCapacitorPlugin',
      globals: {
        '@capacitor/core': 'capacitorExports',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  external: ['@capacitor/core'],
};
