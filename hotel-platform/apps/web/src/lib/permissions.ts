/**
 * Permissões de acesso por CARGO (fonte única do front).
 *
 * Espelha as travas @Roles do backend. O backend é a defesa real (bloqueia a
 * API); aqui garantimos que a NAVEGAÇÃO seja coerente — esconder do menu E
 * bloquear a rota por URL direta, mandando cada cargo para a sua tela inicial.
 */
export type Role =
  | 'ADMIN'
  | 'MANAGER'
  | 'RECEPTION'
  | 'HOUSEKEEPING_SUPERVISOR'
  | 'HOUSEKEEPER';

/** Prefixo de rota → cargos que podem acessar. */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: '/dashboard', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  { prefix: '/painel', roles: ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER'] },
  { prefix: '/agenda', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  { prefix: '/quartos', roles: ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR'] },
  { prefix: '/reservas', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  { prefix: '/hospedes', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  { prefix: '/housekeeping', roles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR'] },
  { prefix: '/minha-limpeza', roles: ['HOUSEKEEPER'] },
  { prefix: '/almoxarifado', roles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR'] },
  { prefix: '/relatorios', roles: ['ADMIN', 'MANAGER'] },
  { prefix: '/usuarios', roles: ['ADMIN', 'MANAGER'] },
];

/** Um cargo pode acessar a rota? Rotas sem regra explícita são liberadas. */
export function canAccess(role: string | undefined, path: string): boolean {
  if (!role) return false;
  const entry = ROUTE_ACCESS.find(
    (e) => path === e.prefix || path.startsWith(e.prefix + '/'),
  );
  if (!entry) return true;
  return entry.roles.includes(role as Role);
}

/** Tela inicial natural de cada cargo (após login ou ao cair numa rota vetada). */
export function homeFor(role: string | undefined): string {
  switch (role) {
    case 'HOUSEKEEPER':
      return '/minha-limpeza';
    case 'HOUSEKEEPING_SUPERVISOR':
      return '/housekeeping';
    default:
      return '/dashboard';
  }
}
