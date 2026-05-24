const API = '/api';

export interface AuthUser {
  username: string;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    authenticated?: boolean;
    username?: string;
    authDisabled?: boolean;
  };
  if (data.authDisabled) return { username: 'local' };
  if (!data.authenticated || !data.username) return null;
  return { username: data.username };
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Error de autenticación');
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
