export interface SettingField {
  key: string;
  label: string;
  section: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'password';
  secret?: boolean;
  description?: string;
  restartRequired?: boolean;
  value: string;
  hasValue: boolean;
  masked?: string;
}

export interface SettingsData {
  sections: string[];
  fields: SettingField[];
  envPath: string;
}

export interface SaveSettingsResult {
  ok: true;
  requiresRestart: boolean;
  warnings: string[];
}

const API = '/api';

export async function fetchSettings(): Promise<SettingsData> {
  const res = await fetch(`${API}/settings`, { credentials: 'include' });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Error cargando configuración');
  }
  return res.json() as Promise<SettingsData>;
}

export async function saveSettings(
  updates: Record<string, string>,
): Promise<SaveSettingsResult> {
  const res = await fetch(`${API}/settings`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Error guardando configuración');
  }

  return res.json() as Promise<SaveSettingsResult>;
}

export const SECRET_PLACEHOLDER = '__UNCHANGED__';
