import { useState } from 'react';

export interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, displayName: string) => Promise<void>;

  subtitle?: string;
}

export function LoginForm({ onLogin, onRegister, subtitle }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        await onRegister(email, password, displayName);
      } else {
        await onLogin(email, password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не вдалося увійти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dr-auth">
      <form className="dr-auth__card" onSubmit={submit}>
        <h1 className="dr-auth__title">Віддалений диск</h1>
        {subtitle && <p className="dr-auth__subtitle">{subtitle}</p>}

        <div className="dr-segmented dr-auth__tabs">
          <button
            type="button"
            className={!isRegister ? 'is-active' : ''}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Вхід
          </button>
          <button
            type="button"
            className={isRegister ? 'is-active' : ''}
            onClick={() => { setMode('register'); setError(null); }}
          >
            Реєстрація
          </button>
        </div>

        {isRegister && (
          <label className="dr-field">
            <span>Ім'я</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Олена Тимченко"
              required
              autoComplete="name"
            />
          </label>
        )}

        <label className="dr-field">
          <span>Електронна пошта</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="olena@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label className="dr-field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isRegister ? 8 : undefined}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {isRegister && (
          <p className="dr-auth__hint">Пароль — щонайменше 8 символів.</p>
        )}

        {error && <p className="dr-error">{error}</p>}

        <button type="submit" className="dr-button is-primary" disabled={busy}>
          {busy ? 'Хвилинку…' : isRegister ? 'Зареєструватися' : 'Увійти'}
        </button>
      </form>
    </div>
  );
}
