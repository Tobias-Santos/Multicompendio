import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
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

// Título da aba do navegador = título principal da tela (o nome do sistema, do personagem…), para quem usa várias abas,
// o histórico ou um leitor de tela. Acompanha a tela quando o título muda (carregou os dados, por exemplo).
const APP_TITLE = 'Multicompêndio';
function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const main = document.querySelector('h1')?.textContent?.trim() ?? '';
      const h2 = document.querySelector('h2')?.textContent?.trim() ?? '';
      const text = !main || main.includes(APP_TITLE) ? h2 : main; // em entrar e criar conta o h1 é a logo
      document.title = text ? `${text.slice(0, 80)} — ${APP_TITLE}` : `${APP_TITLE} — Sistemas de RPG`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [pathname]);
  return null;
}

function FloatingThemeToggle() {
  const { pathname } = useLocation();
  return pathname === '/entrar' || pathname === '/criar-conta' ? <ThemeToggle /> : null;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <ErrorBoundary resetKey={pathname}>
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
      </ErrorBoundary>

      {/* Nas telas com conta, o botão fica na barra do topo; entrada e cadastro (sem barra) têm o botão flutuante */}
      <FloatingThemeToggle />
      <DocumentTitle />
    </>
  );
}
