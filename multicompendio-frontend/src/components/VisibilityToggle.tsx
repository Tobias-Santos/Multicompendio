import { useState } from 'react';
import { setVisibility } from '../api/charactersApi';
import { CharacterDetail } from '../types/character';

interface Props {
  characterId: string;
  isPublic: boolean;
  isPreconfiguredSystem: boolean;
  onChanged: (detail: CharacterDetail) => void;
}

// Interruptor do dono do personagem: público (as outras pessoas do sistema leem a ficha e a história,
// sem editar) ou privado. No sistema pré-instalado, que é de todos, o personagem é sempre privado.
export function VisibilityToggle({ characterId, isPublic, isPreconfiguredSystem, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPreconfiguredSystem) {
    return (
      <p className="muted visibility-note">
        Os personagens do sistema pré-instalado são sempre privados, porque esse sistema é de todos. Para compartilhar
        fichas, crie um sistema seu ou entre no de outra pessoa.
      </p>
    );
  }

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await setVisibility(characterId, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mudar a visibilidade.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="visibility">
      <label className="visibility-label" title="Público: quem participa deste sistema pode ler a ficha e a história, mas não editar.">
        <input type="checkbox" checked={isPublic} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
        <span>
          <strong>{isPublic ? 'Público neste sistema' : 'Privado'}</strong>
          <span className="muted">
            {isPublic
              ? ' — quem participa deste sistema pode ler a ficha e a história, mas não editar.'
              : ' — só você vê este personagem. Marque para deixá-lo visível às outras pessoas do sistema.'}
          </span>
        </span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
