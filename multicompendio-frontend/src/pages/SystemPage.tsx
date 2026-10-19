import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SystemWithAttributes } from '../types/system';
import { CharacterSummary } from '../types/character';
import { getSystem, deleteSystem } from '../api/systemsApi';
import { deleteCharacter, listCharacters } from '../api/charactersApi';
import { SystemPropertiesForm } from '../components/SystemPropertiesForm';
import { AttributesTable } from '../components/AttributesTable';
import { AddAttributeForm } from '../components/AddAttributeForm';
import { SystemSummary } from '../components/SystemSummary';
import { CharacterList } from '../components/CharacterList';

export function SystemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SystemWithAttributes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);

  function reload() {
    if (!id) return;
    getSystem(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }

  useEffect(reload, [id]);

  function reloadCharacters() {
    if (!id) return;
    listCharacters(id)
      .then(setCharacters)
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao carregar os personagens'));
  }

  useEffect(reloadCharacters, [id]);

  async function handleDeleteCharacter(character: CharacterSummary) {
    if (!confirm(`Excluir o personagem "${character.name}"?`)) return;
    setActionError(null);
    try {
      await deleteCharacter(character.id);
      reloadCharacters();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o personagem.');
    }
  }

  async function handleDeleteSystem() {
    if (!id || !confirm('Excluir este sistema?')) return;
    setActionError(null);
    try {
      await deleteSystem(id);
      navigate('/');
    } catch (err) {
      // erro de ação (ex.: sistema com personagens) não substitui a página inteira
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o sistema.');
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

  const canEdit = data.system.can_edit;

  return (
    <div className="layout">
      <header>
        <Link to="/" className="muted">
          ← voltar
        </Link>
        <h1>{data.system.name}</h1>
      </header>

      {actionError && <p className="error">{actionError}</p>}

      <div className="columns-2">
        <div className="column">
          {canEdit ? (
            <>
              <SystemPropertiesForm
                system={data.system}
                onUpdated={(system) => setData((prev) => (prev ? { ...prev, system } : prev))}
              />

              <button type="button" onClick={handleDeleteSystem} className="danger">
                Excluir sistema
              </button>
            </>
          ) : (
            <SystemSummary system={data.system} />
          )}
        </div>

        <div className="column">
          <div className="card">
            <h2>Atributos</h2>
            <AttributesTable
              systemId={id}
              attributes={data.attributes}
              readOnly={!canEdit}
              onChanged={(updated) =>
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        attributes: prev.attributes.map((a) => (a.id === updated.id ? updated : a)),
                      }
                    : prev,
                )
              }
              onDeleted={(attributeId) =>
                setData((prev) =>
                  prev
                    ? { ...prev, attributes: prev.attributes.filter((a) => a.id !== attributeId) }
                    : prev,
                )
              }
            />
            {canEdit && (
              <>
                <h3>Adicionar atributo</h3>
                <AddAttributeForm
                  systemId={id}
                  onAdded={reload}
                  sections={Array.from(
                    new Set(data.attributes.map((a) => a.group_name).filter((g): g is string => !!g)),
                  )}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <section className="card characters-card">
        <div className="card-header">
          <h2>Personagens</h2>
          <Link
            to={`/sistemas/${id}/personagens/novo`}
            className="button-link"
            title="Cria um personagem usando os atributos deste sistema."
          >
            Novo personagem
          </Link>
        </div>
        <CharacterList characters={characters} onDelete={handleDeleteCharacter} />
      </section>
    </div>
  );
}
