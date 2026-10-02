import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RpgSystem } from '../types/system';
import { listSystems, deleteSystem } from '../api/systemsApi';
import { SystemForm } from '../components/SystemForm';
import { SystemList } from '../components/SystemList';

export function HomePage() {
  const [systems, setSystems] = useState<RpgSystem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function reload() {
    listSystems()
      .then(setSystems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }

  useEffect(reload, []);

  async function handleDelete(id: string) {
    if (!confirm('Excluir este sistema?')) return;
    try {
      await deleteSystem(id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <div className="layout">
      <header>
        <h1>Multicompêndio — Sistemas de RPG</h1>
        <p className="muted">Cadastre um novo sistema e depois abra-o para configurar os detalhes.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="columns-2">
        <div className="column">
          <SystemForm onCreated={(system) => navigate(`/systems/${system.id}`)} />
        </div>

        <div className="column">
          <h2>Sistemas cadastrados</h2>
          <SystemList systems={systems} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
}
