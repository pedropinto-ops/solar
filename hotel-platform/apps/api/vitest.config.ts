import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * O código-fonte usa import specifiers com sufixo `.js` (ESM/NodeNext), mas os
 * arquivos em disco são `.ts`. Este plugin reescreve os imports relativos
 * `./x.js` → `./x.ts` durante os testes, para o Vitest resolver os fontes.
 */
export default defineConfig({
  plugins: [
    {
      name: 'js-to-ts-resolver',
      enforce: 'pre',
      resolveId(source: string, importer?: string) {
        if (importer && source.startsWith('.') && source.endsWith('.js')) {
          const tsPath = resolve(importer, '..', source.slice(0, -3) + '.ts');
          if (existsSync(tsPath)) return tsPath;
        }
        return null;
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
