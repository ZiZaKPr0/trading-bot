import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SECRET_PLACEHOLDER,
  fetchSettings,
  saveSettings,
  type SettingField,
  type SettingsData,
} from './settings-api.js';

interface SettingsViewProps {
  onSaved?: () => void;
}

export function SettingsView({ onSaved }: SettingsViewProps) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await fetchSettings();
      setData(settings);
      const initial: Record<string, string> = {};
      for (const f of settings.fields) {
        initial[f.key] = f.value;
      }
      setValues(initial);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fieldsBySection = useMemo(() => {
    if (!data) return new Map<string, SettingField[]>();
    const map = new Map<string, SettingField[]>();
    for (const section of data.sections) {
      map.set(
        section,
        data.fields.filter((f) => f.section === section),
      );
    }
    return map;
  }, [data]);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setSuccess(null);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const updates: Record<string, string> = {};
    for (const field of data.fields) {
      const current = values[field.key] ?? '';
      const original = field.value;
      if (current !== original) {
        updates[field.key] = current;
      }
    }

    if (Object.keys(updates).length === 0) {
      setError('No hay cambios que guardar');
      setSaving(false);
      return;
    }

    try {
      const result = await saveSettings(updates);
      let msg = 'Configuración guardada en .env';
      if (result.requiresRestart) {
        msg += ' — reinicia los procesos (PM2 o npm run dev) para aplicar algunos cambios';
      }
      if (result.warnings.length > 0) {
        msg += ` · ${result.warnings.join('; ')}`;
      }
      setSuccess(msg);
      setDirty(false);
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  }

  function toggleReveal(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="loading-bar" />
        <p>Cargando configuración…</p>
      </div>
    );
  }

  if (!data) {
    return <div className="error-strip">{error ?? 'Sin datos'}</div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-intro">
        <p>
          Variables de entorno del bot. Los cambios se escriben en{' '}
          <code className="settings-path">{data.envPath}</code>.
        </p>
        <p className="settings-hint">
          Los campos sensibles enmascarados se mantienen si los dejas sin modificar.
          Algunos valores (puertos, auth, bots) requieren reinicio.
        </p>
      </div>

      {error && <div className="error-strip">{error}</div>}
      {success && <div className="success-strip">{success}</div>}

      {data.sections.map((section) => {
        const fields = fieldsBySection.get(section) ?? [];
        return (
          <section key={section} className="settings-section">
            <div className="section-head">
              <h2 className="section-title">{section}</h2>
              <span className="section-count">{fields.length}</span>
            </div>

            <div className="settings-grid">
              {fields.map((field) => (
                <SettingInput
                  key={field.key}
                  field={field}
                  value={values[field.key] ?? ''}
                  revealed={expanded[field.key] ?? false}
                  onChange={(v) => setField(field.key, v)}
                  onToggleReveal={() => toggleReveal(field.key)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn secondary"
          onClick={() => void load()}
          disabled={saving}
        >
          Descartar cambios
        </button>
        <button
          type="button"
          className="settings-btn primary"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
        >
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

function SettingInput({
  field,
  value,
  revealed,
  onChange,
  onToggleReveal,
}: {
  field: SettingField;
  value: string;
  revealed: boolean;
  onChange: (v: string) => void;
  onToggleReveal: () => void;
}) {
  const isSecret = field.secret && field.hasValue;
  const displayPlaceholder = isSecret && value === SECRET_PLACEHOLDER
    ? field.masked ?? '••••'
    : undefined;

  if (field.type === 'boolean') {
    const checked = value === 'true';
    return (
      <label className="settings-field boolean">
        <div className="settings-field-head">
          <span className="settings-label">{field.label}</span>
          <span className="settings-key">{field.key}</span>
        </div>
        <div className="settings-bool-row">
          <button
            type="button"
            className={`toggle ${checked ? 'on' : ''}`}
            onClick={() => onChange(checked ? 'false' : 'true')}
            aria-pressed={checked}
          />
          <span className="settings-bool-text">{checked ? 'Activado' : 'Desactivado'}</span>
        </div>
        {field.description && (
          <p className="settings-desc">{field.description}</p>
        )}
        {field.restartRequired && (
          <span className="settings-badge">Reinicio</span>
        )}
      </label>
    );
  }

  const inputType =
    field.type === 'password' || (isSecret && !revealed) ? 'password' : 'text';

  return (
    <label className="settings-field">
      <div className="settings-field-head">
        <span className="settings-label">{field.label}</span>
        <span className="settings-key">{field.key}</span>
      </div>

      <div className="settings-input-row">
        <input
          type={inputType}
          className="settings-input"
          value={isSecret && !revealed && value === SECRET_PLACEHOLDER ? '' : value}
          placeholder={displayPlaceholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' && isSecret ? SECRET_PLACEHOLDER : v);
          }}
          onFocus={() => {
            if (isSecret && value === SECRET_PLACEHOLDER) {
              onChange('');
            }
          }}
        />
        {isSecret && (
          <button
            type="button"
            className="settings-reveal"
            onClick={onToggleReveal}
          >
            {revealed ? 'Ocultar' : 'Ver'}
          </button>
        )}
      </div>

      {field.description && (
        <p className="settings-desc">{field.description}</p>
      )}
      {field.restartRequired && (
        <span className="settings-badge">Reinicio</span>
      )}
    </label>
  );
}
