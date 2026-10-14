const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'multicompendio.sessao';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Avisa a aplicação quando o servidor recusa a sessão (expirada ou inválida),
// para ela mandar a pessoa de volta à tela de entrada.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

// Rotas que não usam sessão: um 401 ali significa "senha incorreta", não "sessão expirada".
const PUBLIC_PATHS = ['/auth/login', '/auth/register'];

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  const token = isPublic ? null : getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = 'Algo deu errado. Tente novamente.';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // resposta sem corpo JSON — mantém a mensagem padrão
    }

    if (res.status === 401 && !isPublic) {
      clearToken();
      onSessionExpired?.();
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
