import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { HomePage } from './pages/HomePage';
import { SystemPage } from './pages/SystemPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CharacterCreatePage } from './pages/CharacterCreatePage';
import { CharacterPage } from './pages/CharacterPage';
import { InvitePage } from './pages/InvitePage';
import { ThemeToggle } from './theme/ThemeToggle';
import './styles.css';

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
          <Route path="/sistemas/:id/personagens/novo" element={<CharacterCreatePage />} />
          <Route path="/personagens/:id" element={<CharacterPage />} />
          <Route path="/convite/:token" element={<InvitePage />} />
        </Route>
      </Routes>

      {/* Presente em todas as telas, inclusive entrada e cadastro */}
      <ThemeToggle />
    </>
  );
}
