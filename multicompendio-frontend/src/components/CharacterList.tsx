import { Link } from 'react-router-dom';
import { CharacterSummary } from '../types/character';

interface Props {
  characters: CharacterSummary[];
  onDelete?: (character: CharacterSummary) => void; // sem isto, a lista é só de consulta
  showOwner?: boolean; // mostra "criado por ..." (lista de personagens de outras pessoas)
  showVisibility?: boolean; // mostra "Público" ou "Privado" nos personagens da própria pessoa
  emptyMessage?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function CharacterList({
  characters,
  onDelete,
  showOwner = false,
  showVisibility = false,
  emptyMessage = 'Você ainda não criou nenhum personagem neste sistema.',
}: Props) {
  if (characters.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
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
              <h3>
                {character.name}
                {showVisibility && character.is_mine && (
                  <span className={`badge${character.is_public ? ' badge-public' : ''}`}>
                    {character.is_public ? 'Público' : 'Privado'}
                  </span>
                )}
              </h3>
              <p className="muted">
                {showOwner && `Criado por ${character.owner_name} · `}Atualizado em {formatDate(character.updated_at)}
              </p>
            </div>
          </Link>
          {onDelete && character.is_mine && (
            <button type="button" className="danger" onClick={() => onDelete(character)}>
              excluir
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
