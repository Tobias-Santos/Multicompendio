import { LayoutAttribute } from '../../layoutCore';
import { TYPE_LABELS, cx } from './common';

// A gaveta: os campos do sistema que não estão na folha. Dá para arrastar daqui para a folha e de volta (o motor de arrasto trata isso).
interface Props {
  items: LayoutAttribute[]; total: number; query: string; onQuery: (q: string) => void; selectedId: string | null;
  collapsed: boolean; onToggle: () => void; onClose: () => void; onPlace: (id: string) => void;
}

export function Drawer({ items, total, query, onQuery, selectedId, collapsed, onToggle, onClose, onPlace }: Props) {
  const q = query.trim().toLowerCase();
  const shown = items.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.group ?? '').toLowerCase().includes(q));
  return (
    <aside className="le-drawer" id="le-drawer" aria-label="Gaveta: campos fora da folha">
      <div className="le-drawer-head">
        <h2>Gaveta <span id="le-drawer-n">{total}</span></h2>
        <span className="le-count-mini">{total}</span>
        <button type="button" className="le-drawer-toggle" id="le-drawer-toggle" aria-expanded={!collapsed} title="Recolher ou abrir a gaveta" aria-label="Recolher ou abrir a gaveta" onClick={onToggle}>⇔</button>
        <button type="button" className="le-btn le-drawer-close" aria-label="Fechar a gaveta" onClick={onClose}>Fechar</button>
      </div>
      <div className="le-drawer-body">
        <p className="le-hint">Campos do sistema que não estão na folha. Arraste para a folha, onde quiser; arraste de volta para guardar. O tamanho e o formato ficam lembrados.</p>
        <input type="search" placeholder="Buscar campo…" aria-label="Buscar campo na gaveta" value={query} onChange={(e) => onQuery(e.target.value)} />
        <ul className="le-dlist" id="le-dlist">
          {shown.map((a) => (
            <li key={a.id} className={cx('le-dchip', selectedId === a.id && 'is-sel')} data-field={a.id} tabIndex={0} role="button" aria-label={`${a.name}, na gaveta`}>
              <span className="le-grip" aria-hidden="true">⠿</span>
              <span className="le-dn">
                <b>{a.name}</b>
                <small>{TYPE_LABELS[a.type]}{a.group ? ` · ${a.group}` : ''}</small>
              </span>
              <button type="button" title="Coloca no primeiro espaço livre da seção selecionada (ou da última)" onClick={() => onPlace(a.id)}>Colocar</button>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="le-drawer-empty">{total ? 'Nenhum campo com esse nome.' : 'A gaveta está vazia: todos os campos estão na folha.'}</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
