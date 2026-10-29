import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ItemDetail } from '../types/item';
import { deleteItem, getItem, setItemVisibility, updateItem } from '../api/itemsApi';
import { CharacterForm } from '../components/CharacterForm';
import { ItemStatBlock } from '../components/ItemStatBlock';
import { VisibilityToggle } from '../components/VisibilityToggle';

export function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getItem(id)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, [id]);

  async function handleDelete() {
    if (!id || !data || !confirm(`Excluir o item "${data.item.name}"?`)) return;
    setActionError(null);
    try {
      await deleteItem(id);
      navigate(`/sistemas/${data.item.system_id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível excluir o item.');
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

  const { item, fields, values } = data;

  return (
    <div className="layout narrow">
      <header>
        <Link to={`/sistemas/${item.system_id}`} className="muted">
          ← {item.system_name}
        </Link>
        <h1>{item.name}</h1>
      </header>

      {item.is_preinstalled && (
        <p className="readonly-banner" role="note">
          Este item já vem com o sistema pré-instalado e é somente para consulta.
        </p>
      )}
      {!item.is_preinstalled && !item.can_edit && (
        <p className="readonly-banner" role="note">
          Item de <strong>{item.owner_name}</strong>, público neste sistema. Você pode consultá-lo e colocá-lo no inventário
          dos seus personagens, mas não editar.
        </p>
      )}
      {item.can_edit && (
        <VisibilityToggle
          noun="item"
          isPublic={item.is_public}
          isPreconfiguredSystem={item.system_is_preconfigured}
          onSet={async (next) => setData(await setItemVisibility(id, next))}
        />
      )}

      <ItemStatBlock
        name={item.name}
        fields={fields}
        values={values}
        caption={item.is_preinstalled ? 'Item do sistema' : item.owner_name ? `Criado por ${item.owner_name}` : undefined}
      />

      {item.can_edit && (
        <>
          <h2>Editar item</h2>
          <CharacterForm
            subject="item"
            attributes={fields}
            initialName={item.name}
            initialValues={values}
            submitLabel="Salvar alterações"
            submittingLabel="Salvando..."
            onSubmit={async (input) => {
              setData(await updateItem(id, input));
            }}
          />
          {actionError && <p className="error">{actionError}</p>}
          <button type="button" className="danger" onClick={handleDelete}>
            Excluir item
          </button>
        </>
      )}
    </div>
  );
}
