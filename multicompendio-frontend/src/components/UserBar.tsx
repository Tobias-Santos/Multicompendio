import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Faixa no topo das páginas internas: mostra quem está com a conta aberta
// e permite sair.
export function UserBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate('/entrar');
  }

  return (
    <div className="user-bar">
      <span className="user-bar-name">
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
  );
}
