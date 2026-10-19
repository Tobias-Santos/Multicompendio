import { Link } from 'react-router-dom';
import { CharacterSummary } from '../types/character';

interface Props {
  characters: CharacterSummary[];
  onDelete: (character: CharacterSummary) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function CharacterList({ characters, onDelete }: Props) {
  if (characters.length === 0) {
    return <p className="muted">Você ainda não criou nenhum personagem neste sistema.</p>;
  }

  return (
    <ul className="system-list">
      {characters.map((character) => (
        <li key={character.id}>
          <Link to={`/personagens/${character.id}`} className="system-list-link">
            <div className="system-entry-cover-placeholder" aria-hidden="true">
              {character.name.charAt(0).toUpperCase()}
            </div>
            <div className="system-entry-text">
              <h3>{character.name}</h3>
              <p className="muted">Atualizado em {formatDate(character.updated_at)}</p>
            </div>
          </Link>
          <button type="button" className="danger" onClick={() => onDelete(character)}>
            excluir
          </button>
        </li>
      ))}
    </ul>
  );
}
