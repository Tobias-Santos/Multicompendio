import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { SystemPage } from './pages/SystemPage';
import './styles.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/systems/:id" element={<SystemPage />} />
    </Routes>
  );
}
