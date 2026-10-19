import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { InfoLabel } from '../components/InfoLabel';
import { BrandLogo } from '../components/BrandLogo';

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError('As duas senhas precisam ser iguais.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.');
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
        <h2>Criar conta</h2>

        <label>
          <InfoLabel text="Seu nome" info="Como você quer ser chamado. Aparece como proprietário dos sistemas que você criar." />
          <input
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label>
          <InfoLabel text="E-mail" info="Você vai usar este e-mail para entrar. Ele não pode ser repetido em outra conta." />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          <InfoLabel text="Senha" info="Escolha uma senha com pelo menos 8 caracteres." />
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <label>
          <InfoLabel text="Repetir senha" info="Digite a mesma senha de novo, para garantir que não houve erro de digitação." />
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="muted auth-switch">
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
