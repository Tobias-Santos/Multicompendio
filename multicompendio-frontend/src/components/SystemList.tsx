import { Link } from 'react-router-dom';
import { RpgSystem } from '../types/system';

interface Props {
  systems: RpgSystem[];
  onDelete: (id: string) => void;
}

export function SystemList({ systems, onDelete }: Props) {
  if (systems.length === 0) {
    return <p className="muted">Nenhum sistema cadastrado ainda.</p>;
  }

  return (
    <ul className="system-list">
      {systems.map((system) => (
        <li key={system.id}>
          <Link
            to={`/sistemas/${system.id}`}
            className="system-list-link"
            title={system.description ? `${system.name} — ${system.description}` : system.name}
          >
            {system.image_url ? (
              <img src={system.image_url} alt="" className="system-entry-cover" />
            ) : (
              <div className="system-entry-cover-placeholder" aria-hidden="true">
                {system.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="system-entry-text">
              <h3>
                {system.name}
                {system.version && <span className="muted"> — {system.version}</span>}
              </h3>
              {system.description && <p className="muted">{system.description}</p>}
            </div>
          </Link>
          {system.can_edit && (
            <button
              type="button"
              className="danger"
              onClick={(e) => {
                e.preventDefault();
                onDelete(system.id);
              }}
            >
              excluir
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
