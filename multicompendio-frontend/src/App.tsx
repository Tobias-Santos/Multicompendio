import { Routes, Route, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { SystemPage } from './pages/SystemPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CharacterCreatePage } from './pages/CharacterCreatePage';
import { CharacterPage } from './pages/CharacterPage';
import { InvitePage } from './pages/InvitePage';
import { ItemPage } from './pages/ItemPage';
import { ItemCreatePage } from './pages/ItemCreatePage';
import { LayoutEditorPage } from './pages/LayoutEditorPage';
import { ThemeToggle } from './theme/ThemeToggle';
import './styles.css';

function FloatingThemeToggle() {
  const { pathname } = useLocation();
  return pathname === '/entrar' || pathname === '/criar-conta' ? <ThemeToggle /> : null;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/criar-conta" element={<RegisterPage />} />

        {/* Páginas que exigem conta */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sistemas/:id" element={<SystemPage />} />
          <Route path="/sistemas/:id/layout" element={<LayoutEditorPage />} />
          <Route path="/sistemas/:id/personagens/novo" element={<CharacterCreatePage />} />
          <Route path="/personagens/:id" element={<CharacterPage />} />
          <Route path="/convite/:token" element={<InvitePage />} />
          <Route path="/sistemas/:id/itens/novo" element={<ItemCreatePage />} />
          <Route path="/itens/:id" element={<ItemPage />} />
        </Route>
      </Routes>

      {/* Nas telas com conta, o botão fica na barra do topo; entrada e cadastro (sem barra) têm o botão flutuante */}
      <FloatingThemeToggle />
    </>
  );
}
