import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { InfoLabel } from '../components/InfoLabel';
import { BrandLogo } from '../components/BrandLogo';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <header className="auth-brand">
        <h1>
          <BrandLogo className="auth-logo" />
        </h1>
        <p className="muted">Seus sistemas de RPG, organizados em um só lugar.</p>
      </header>

      <form onSubmit={handleSubmit} className="card auth-card">
        <h2>Entrar</h2>

        <label>
          <InfoLabel text="E-mail" info="O e-mail que você usou ao criar a sua conta." />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          <InfoLabel text="Senha" info="A senha que você escolheu ao criar a sua conta." />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="muted auth-switch">
          Ainda não tem conta? <Link to="/criar-conta" state={location.state}>Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
