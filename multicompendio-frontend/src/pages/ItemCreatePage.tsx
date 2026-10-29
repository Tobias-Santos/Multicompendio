import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SystemWithAttributes } from '../types/system';
import { getSystem } from '../api/systemsApi';
import { createItem } from '../api/itemsApi';
import { CharacterForm } from '../components/CharacterForm';

export function ItemCreatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SystemWithAttributes | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getSystem(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, [id]);

  if (error) {
    return (
      <div className="layout">
        <p className="error">{error}</p>
        <Link to="/">← voltar</Link>
      </div>
    );
  }

  if (!data || !id) {
    return (
      <div className="layout">
        <p className="muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="layout narrow">
      <header>
        <Link to={`/sistemas/${id}`} className="muted">
          ← {data.system.name}
        </Link>
        <h1>Novo item</h1>
        <p className="muted">Os campos abaixo vêm dos campos de item do sistema {data.system.name}.</p>
      </header>

      {data.item_fields.length === 0 && (
        <p className="readonly-note">Este sistema ainda não tem campos de item, então o item terá apenas o nome.</p>
      )}

      <CharacterForm
        subject="item"
        attributes={data.item_fields}
        submitLabel="Criar item"
        submittingLabel="Criando..."
        onSubmit={async (input) => {
          const created = await createItem(id, input);
          navigate(`/itens/${created.item.id}`);
        }}
      />
    </div>
  );
}
