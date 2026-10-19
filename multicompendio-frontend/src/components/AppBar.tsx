import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from './BrandLogo';

// Barra no topo das páginas internas: a marca (leva à tela inicial) e,
// do outro lado, quem está com a conta aberta e o botão de sair.
export function AppBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate('/entrar');
  }

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Link to="/" className="brand-link" title="Voltar para a tela inicial" aria-label="Multicompêndio — tela inicial">
          <BrandLogo compact />
        </Link>

        <div className="user-box">
          <span className="user-box-name">
            Olá, <strong>{user.name}</strong>
          </span>
          <button
            type="button"
            className="ghost"
            title="Encerrar a sua sessão neste navegador."
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
