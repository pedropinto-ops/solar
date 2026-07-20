/**
 * Cliente HTTP simples para a API.
 * Cuida do JWT (localStorage) e tratamento básico de erros.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'hotel_auth_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode?: string,
    public context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const url = path.startsWith('http') ? path : `${API_URL}${path}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Tenta parsear corpo (pode estar vazio em 204)
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // Sessão expirada ou revogada (senha trocada / usuário desativado).
    // Antes disto o portal só mostrava um erro genérico na tela onde o
    // usuário estivesse e ele ficava travado, sem entender o que houve.
    // Agora limpamos o crachá e mandamos para o login com aviso claro.
    const isLoginAttempt = path.includes('/auth/login');
    if (response.status === 401 && !skipAuth && !isLoginAttempt && getToken()) {
      clearToken();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login')
      ) {
        window.location.href = '/login?expirada=1';
        // Interrompe o fluxo: a navegação já está a caminho.
        throw new ApiError('Sessão expirada', 401, 'SESSION_EXPIRED');
      }
    }

    throw new ApiError(
      data?.title || data?.message || response.statusText,
      response.status,
      data?.errorCode,
      data?.context,
    );
  }

  return data as T;
}
