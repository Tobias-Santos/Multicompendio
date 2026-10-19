import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CharacterDetail } from '../types/character';
import { deleteCharacter, getCharacter, updateCharacter } from '../api/charactersApi';
import { CharacterForm } from '../components/CharacterForm';

export function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CharacterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCharacter(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, [id]);

  async function handleDelete() {
    if (!id || !data || !confirm(`Excluir o personagem "${data.character.name}"?`)) return;
    try {
      await deleteCharacter(id);
      navigate(`/sistemas/${data.character.system_id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o personagem.');
    }
  }

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
        <Link to={`/sistemas/${data.character.system_id}`} className="muted">
          ← {data.character.system_name}
        </Link>
        <h1>{data.character.name}</h1>
      </header>

      <CharacterForm
        attributes={data.attributes}
        initialName={data.character.name}
        initialValues={data.values}
        submitLabel="Salvar alterações"
        submittingLabel="Salvando..."
        onSubmit={async (input) => {
          setData(await updateCharacter(id, input));
        }}
      />

      {actionError && <p className="error">{actionError}</p>}

      <button type="button" className="danger" onClick={handleDelete}>
        Excluir personagem
      </button>
    </div>
  );
}
