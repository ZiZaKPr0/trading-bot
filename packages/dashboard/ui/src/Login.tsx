import { useState, type FormEvent } from 'react';
import { login } from './auth.js';

interface LoginProps {
  onSuccess: () => void | Promise<void>;
  error?: string | null;
}

export function Login({ onSuccess, error: externalError }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de acceso');
    } finally {
      setLoading(false);
    }
  }

  const displayError = error ?? externalError;

  return (
    <div className="login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <p className="brand-mark">PM Desk</p>
          <p className="brand-sub">Acceso al panel de control</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {displayError && <p className="login-error">{displayError}</p>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verificando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-foot">
          Acceso restringido · Solo personal autorizado
        </p>
      </div>
    </div>
  );
}
