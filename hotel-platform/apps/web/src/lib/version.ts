/**
 * Versão do sistema — formato XX.ZZ (ex.: 1.00, 1.03, 2.00).
 *
 * Regra de incremento (a cada modificação do sistema):
 *  - Alteração PEQUENA  → incrementa ZZ (ex.: 1.03 → 1.04)
 *  - Alteração GRANDE   → incrementa XX e zera ZZ (ex.: 1.09 → 2.00)
 *
 * Fonte única exibida no rodapé do portal.
 */
export const APP_VERSION = '5.16';
