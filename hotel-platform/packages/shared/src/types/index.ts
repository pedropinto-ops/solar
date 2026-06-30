/**
 * Tipos auxiliares compartilhados entre backend e frontend.
 * Os tipos de modelo (Reservation, Guest, etc) vêm de @hotel/database.
 */

/**
 * Resposta padrão de erro (RFC 7807 — Problem Details).
 */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errorCode?: string;
  context?: Record<string, unknown>;
}

/**
 * Resposta paginada.
 */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Resposta de autenticação.
 */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    propertyId: string;
  };
}

/**
 * Códigos de erro de domínio (não-HTTP).
 * Frontend traduz por código, não por mensagem.
 */
export const DomainErrorCode = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Reservation
  ROOM_NOT_AVAILABLE: 'ROOM_NOT_AVAILABLE',
  ROOM_NO_LONGER_AVAILABLE: 'ROOM_NO_LONGER_AVAILABLE',
  HOLD_EXPIRED: 'HOLD_EXPIRED',
  INVALID_RESERVATION_STATUS: 'INVALID_RESERVATION_STATUS',
  PAYMENT_INSUFFICIENT: 'PAYMENT_INSUFFICIENT',
  FNRH_FIELDS_MISSING: 'FNRH_FIELDS_MISSING',
  BALANCE_NOT_ZERO: 'BALANCE_NOT_ZERO',
  CHECKIN_TOO_EARLY: 'CHECKIN_TOO_EARLY',

  // Stock
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',

  // Payment
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
  WEBHOOK_INVALID: 'WEBHOOK_INVALID',

  // Fiscal
  NFSE_EMISSION_FAILED: 'NFSE_EMISSION_FAILED',

  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;

export type DomainErrorCodeType =
  (typeof DomainErrorCode)[keyof typeof DomainErrorCode];
