import { Link } from 'react-router-dom';
import { SystemAttribute } from '../types/system';
import { ItemSummary } from '../types/item';

interface Props {
  items: ItemSummary[];
  fields: SystemAttribute[];
  onDelete?: (item: ItemSummary) => void; // sem isto, a lista é só de consulta
  showOwner?: boolean;
  emptyMessage?: string;
}

// Resumo de uma linha: os primeiros campos preenchidos do item (ex.: "Arma · 1d4 · Perfurante").
function summaryOf(item: ItemSummary, fields: SystemAttribute[]): string {
  return fields
    .filter((f) => f.data_type !== 'longtext' && item.values[f.id] !== undefined && item.values[f.id] !== '')
    .slice(0, 3)
    .map((f) => {
      const v = item.values[f.id];
      if (typeof v === 'boolean') return v ? f.name : `Sem ${f.name.toLowerCase()}`;
      if (typeof v === 'object') return v.number !== null ? `${f.name} ${v.number}` : f.name;
      return String(v);
    })
    .join(' · ');
}

export function ItemList({ items, fields, onDelete, showOwner = false, emptyMessage = 'Nenhum item ainda.' }: Props) {
  if (items.length === 0) return <p className="muted">{emptyMessage}</p>;

  return (
    <ul className="system-list">
      {items.map((item) => {
        const summary = summaryOf(item, fields);
        return (
          <li key={item.id}>
            <Link to={`/itens/${item.id}`} className="system-list-link">
              <div className="system-entry-cover-placeholder" aria-hidden="true">
                {item.name.charAt(0).toUpperCase()}
              </div>
              <div className="system-entry-text">
                <h3>
                  {item.name}
                  {item.is_preinstalled ? (
                    <span className="badge" title="Já vem com o sistema pré-instalado.">Pré-instalado</span>
                  ) : (
                    item.is_mine && (
                      <span className={`badge${item.is_public ? ' badge-public' : ''}`}>
                        {item.is_public ? 'Público' : 'Privado'}
                      </span>
                    )
                  )}
                </h3>
                <p className="muted">
                  {showOwner && item.owner_name && `Criado por ${item.owner_name}`}
                  {showOwner && item.owner_name && summary && ' · '}
                  {summary}
                </p>
              </div>
            </Link>
            {onDelete && item.is_mine && (
              <button type="button" className="danger" onClick={() => onDelete(item)}>
                excluir
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
