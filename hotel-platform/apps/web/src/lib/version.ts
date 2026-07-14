/**
 * VersÃ£o do sistema â€” formato XX.ZZ (ex.: 1.00, 1.03, 2.00).
 *
 * Regra de incremento (a cada modificaÃ§Ã£o do sistema):
 *  - AlteraÃ§Ã£o PEQUENA  â†’ incrementa ZZ (ex.: 1.03 â†’ 1.04)
 *  - AlteraÃ§Ã£o GRANDE   â†’ incrementa XX e zera ZZ (ex.: 1.09 â†’ 2.00)
 *
 * Fonte Ãºnica exibida no rodapÃ© do portal.
 */
export const APP_VERSION = '4.13';
