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
          <Link to={`/systems/${system.id}`} className="system-list-link">
            <strong>
              {system.name}
              {system.version && <span className="muted"> — v{system.version}</span>}
            </strong>
            {system.description && <p className="muted">{system.description}</p>}
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete(system.id);
            }}
          >
            excluir
          </button>
        </li>
      ))}
    </ul>
  );
}
