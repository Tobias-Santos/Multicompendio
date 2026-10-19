import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SystemWithAttributes } from '../types/system';
import { getSystem } from '../api/systemsApi';
import { createCharacter } from '../api/charactersApi';
import { CharacterForm } from '../components/CharacterForm';

export function CharacterCreatePage() {
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
        <h1>Novo personagem</h1>
        <p className="muted">Os campos abaixo vêm dos atributos do sistema {data.system.name}.</p>
      </header>

      {data.attributes.length === 0 && (
        <p className="readonly-note">
          Este sistema ainda não tem atributos, então o personagem terá apenas o nome.
        </p>
      )}

      <CharacterForm
        attributes={data.attributes}
        submitLabel="Criar personagem"
        submittingLabel="Criando..."
        onSubmit={async (input) => {
          const created = await createCharacter(id, input);
          navigate(`/personagens/${created.character.id}`);
        }}
      />
    </div>
  );
}
