import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { UserBar } from './UserBar';

// Envolve as páginas que exigem conta: sem sessão, manda para a tela de entrada
// (guardando para onde a pessoa queria ir).
export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="layout">
        <p className="muted">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      <UserBar />
      <Outlet />
    </>
  );
}
