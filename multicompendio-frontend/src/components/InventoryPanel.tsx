import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInventory, listItems, removeInventoryItem, setInventoryItem } from '../api/itemsApi';
import { Inventory } from '../types/item';
import { ItemSummary } from '../types/item';
import { ItemStatBlock } from './ItemStatBlock';

interface Props {
  characterId: string;
  systemId: string;
  canEdit: boolean; // só o dono do personagem altera o inventário
}

// Aba "Itens" do personagem: o que ele carrega, com quantidade e o bloco de estatísticas de cada item.
export function InventoryPanel({ characterId, systemId, canEdit }: Props) {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [available, setAvailable] = useState<ItemSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getInventory(characterId)
      .then(setInventory)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar o inventário.'));
    if (canEdit) {
      listItems(systemId)
        .then((list) => setAvailable(list.items))
        .catch(() => setAvailable([]));
    }
  }, [characterId, systemId, canEdit]);

  const inInventory = useMemo(() => new Set(inventory?.entries.map((e) => e.item_id)), [inventory]);
  const choices = available.filter((item) => !inInventory.has(item.id));
  const mine = choices.filter((i) => i.is_mine);
  const others = choices.filter((i) => !i.is_mine);

  async function run(action: () => Promise<Inventory | void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result) setInventory(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  const parseQty = (raw: string) => (/^\d+$/.test(raw.trim()) ? Number(raw) : NaN);

  function commitQuantity(itemId: string, current: number) {
    const raw = draft[itemId];
    if (raw === undefined) return;
    const qty = parseQty(raw);
    setDraft(({ [itemId]: _drop, ...rest }) => rest);
    if (!Number.isInteger(qty) || qty === current) return;
    void run(() => setInventoryItem(characterId, itemId, qty));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    await run(async () => {
      const result = await setInventoryItem(characterId, chosen, parseQty(newQty));
      setChosen('');
      setNewQty('1');
      return result;
    });
  }

  if (!inventory) {
    return error ? <p className="error" role="alert">{error}</p> : <p className="muted">Carregando o inventário…</p>;
  }

  return (
    <section className="card inventory-card" aria-labelledby="titulo-inventario">
      <h2 id="titulo-inventario">Inventário</h2>
      {error && <p className="error" role="alert">{error}</p>}

      {inventory.entries.length === 0 ? (
        <p className="muted">{canEdit ? 'Este personagem ainda não carrega nenhum item.' : 'Este personagem não carrega nenhum item.'}</p>
      ) : (
        <ul className="inventory-list">
          {inventory.entries.map((entry) => (
            <li key={entry.item_id}>
              <details>
                <summary>
                  <span className="inventory-name">{entry.viewable ? entry.name : 'Item privado'}</span>
                  <span className="inventory-qty"> × {entry.quantity}</span>
                </summary>
                {entry.viewable && entry.name ? (
                  <>
                    <ItemStatBlock
                      name={entry.name}
                      fields={inventory.fields}
                      values={entry.values}
                      caption={entry.is_preinstalled ? 'Item do sistema' : entry.owner_name ? `Criado por ${entry.owner_name}` : undefined}
                    />
                    <Link to={`/itens/${entry.item_id}`}>Abrir o item</Link>
                  </>
                ) : (
                  <p className="muted">Este item é privado: só quem o criou vê o nome e os campos.</p>
                )}
              </details>
              {canEdit && (
                <div className="inventory-actions">
                  <label className="inventory-qty-field">
                    <span>Quantidade</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={draft[entry.item_id] ?? String(entry.quantity)}
                      title="Quantas unidades deste item o personagem carrega."
                      onChange={(e) => setDraft((d) => ({ ...d, [entry.item_id]: e.target.value }))}
                      onBlur={() => commitQuantity(entry.item_id, entry.quantity)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitQuantity(entry.item_id, entry.quantity);
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    title="Tira o item do inventário (o item em si continua existindo)."
                    onClick={() => void run(async () => { await removeInventoryItem(characterId, entry.item_id); return getInventory(characterId); })}
                  >
                    remover
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form className="inventory-add" onSubmit={handleAdd}>
          <h3>Adicionar item</h3>
          {choices.length === 0 ? (
            <p className="muted">
              Não há outros itens neste sistema para adicionar.{' '}
              <Link to={`/sistemas/${systemId}/itens/novo`}>Criar um item</Link>
            </p>
          ) : (
            <div className="inventory-add-row">
              <select
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                aria-label="Item a adicionar"
                title="Escolha um item do sistema para colocar no inventário."
              >
                <option value="">Escolha um item…</option>
                {mine.length > 0 && (
                  <optgroup label="Meus itens">
                    {mine.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Itens do sistema">
                    {others.map((i) => <option key={i.id} value={i.id}>{i.name}{i.owner_name ? ` (de ${i.owner_name})` : ''}</option>)}
                  </optgroup>
                )}
              </select>
              <input
                type="number"
                min={1}
                max={9999}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                aria-label="Quantidade"
                title="Quantas unidades."
              />
              <button type="submit" disabled={busy || !chosen}>
                Adicionar
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}
