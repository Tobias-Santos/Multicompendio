import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SystemWithAttributes } from '../types/system';
import { CharacterSummary } from '../types/character';
import { getSystem, deleteSystem } from '../api/systemsApi';
import { leaveSystem } from '../api/sharingApi';
import { SharePanel } from '../components/SharePanel';
import { deleteCharacter, listCharacters } from '../api/charactersApi';
import { SystemPropertiesForm } from '../components/SystemPropertiesForm';
import { AttributesTable } from '../components/AttributesTable';
import { AddAttributeForm } from '../components/AddAttributeForm';
import { SystemSummary } from '../components/SystemSummary';
import { CharacterList } from '../components/CharacterList';
import { ItemList } from '../components/ItemList';
import { deleteItem, listItems } from '../api/itemsApi';
import { ItemSummary, ItemList as ItemListData } from '../types/item';

export function SystemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SystemWithAttributes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [itemList, setItemList] = useState<ItemListData>({ fields: [], items: [] });

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

  function reloadItems() {
    if (!id) return;
    listItems(id)
      .then(setItemList)
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao carregar os itens'));
  }

  useEffect(reloadItems, [id]);

  async function handleDeleteItem(item: ItemSummary) {
    if (!confirm(`Excluir o item "${item.name}"?`)) return;
    setActionError(null);
    try {
      await deleteItem(item.id);
      reloadItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o item.');
    }
  }

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

  async function handleLeave() {
    if (!id || !confirm('Sair deste sistema? Você deixa de vê-lo e de criar personagens nele.')) return;
    setActionError(null);
    try {
      await leaveSystem(id);
      navigate('/');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível sair do sistema.');
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

              <SharePanel systemId={id} />

              <button type="button" onClick={handleDeleteSystem} className="danger">
                Excluir sistema
              </button>
            </>
          ) : (
            <>
              <SystemSummary system={data.system} />
              {data.system.is_member && (
                <button
                  type="button"
                  className="danger"
                  onClick={handleLeave}
                  title="Você só pode sair se não tiver personagens neste sistema."
                >
                  Sair deste sistema
                </button>
              )}
            </>
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

          <div className="card">
            <h2>Campos dos itens</h2>
            <p className="muted">
              Definem o que cada item deste sistema tem (por exemplo, dano e peso) e formam o bloco de estatísticas do item.
            </p>
            <AttributesTable
              kind="item_field"
              systemId={id}
              attributes={data.item_fields}
              readOnly={!canEdit}
              onChanged={(updated) =>
                setData((prev) =>
                  prev
                    ? { ...prev, item_fields: prev.item_fields.map((f) => (f.id === updated.id ? updated : f)) }
                    : prev,
                )
              }
              onDeleted={(fieldId) =>
                setData((prev) =>
                  prev ? { ...prev, item_fields: prev.item_fields.filter((f) => f.id !== fieldId) } : prev,
                )
              }
            />
            {canEdit && (
              <>
                <h3>Adicionar campo</h3>
                <AddAttributeForm kind="item_field" systemId={id} onAdded={reload} />
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
        <CharacterList
          characters={characters.filter((c) => c.is_mine)}
          onDelete={handleDeleteCharacter}
          showVisibility={!data.system.is_preconfigured}
        />
      </section>

      <section className="card items-card" aria-labelledby="titulo-itens">
        <div className="card-header">
          <h2 id="titulo-itens">Itens</h2>
          <Link
            to={`/sistemas/${id}/itens/novo`}
            className="button-link"
            title="Cria um item (arma, armadura, objeto…) usando os campos de item deste sistema."
          >
            Novo item
          </Link>
        </div>
        <h3>Meus itens</h3>
        <ItemList
          items={itemList.items.filter((i) => i.is_mine)}
          fields={itemList.fields}
          onDelete={handleDeleteItem}
          emptyMessage="Você ainda não criou nenhum item neste sistema."
        />
        {itemList.items.some((i) => !i.is_mine) && (
          <>
            <h3>{data.system.is_preconfigured ? 'Itens do sistema' : 'Itens do sistema e públicos'}</h3>
            <ItemList items={itemList.items.filter((i) => !i.is_mine)} fields={itemList.fields} showOwner />
          </>
        )}
      </section>

      {characters.some((c) => !c.is_mine) && (
        <section className="card characters-card" aria-labelledby="titulo-publicos">
          <div className="card-header">
            <h2 id="titulo-publicos">Personagens públicos</h2>
          </div>
          <p className="muted">Personagens que outras pessoas deste sistema deixaram visíveis. Você pode ler, mas não editar.</p>
          <CharacterList characters={characters.filter((c) => !c.is_mine)} showOwner />
        </section>
      )}
    </div>
  );
}
