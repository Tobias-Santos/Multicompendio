import { useState } from 'react';

interface Props {
  noun: 'personagem' | 'item';
  isPublic: boolean;
  isPreconfiguredSystem: boolean;
  onSet: (isPublic: boolean) => Promise<void>; // quem usa grava e atualiza a tela
}

// Interruptor do dono: público (as outras pessoas do sistema leem, sem editar) ou privado.
// No sistema pré-instalado, que é de todos, o que a pessoa cria é sempre privado.
export function VisibilityToggle({ noun, isPublic, isPreconfiguredSystem, onSet }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const read = noun === 'personagem' ? 'a ficha e a história' : 'o item e os seus campos';

  if (isPreconfiguredSystem) {
    return (
      <p className="muted visibility-note">
        {noun === 'personagem'
          ? 'Os personagens do sistema pré-instalado são sempre privados, porque esse sistema é de todos. Para compartilhar fichas, crie um sistema seu ou entre no de outra pessoa.'
          : 'Os itens que você cria no sistema pré-instalado são sempre privados, porque esse sistema é de todos. Para compartilhar itens, crie um sistema seu ou entre no de outra pessoa.'}
      </p>
    );
  }

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      await onSet(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mudar a visibilidade.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="visibility">
      <label className="visibility-label" title={`Público: quem participa deste sistema pode ler ${read}, mas não editar.`}>
        <input type="checkbox" checked={isPublic} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
        <span>
          <strong>{isPublic ? 'Público neste sistema' : 'Privado'}</strong>
          <span className="muted">
            {isPublic
              ? ` — quem participa deste sistema pode ler ${read}, mas não editar.`
              : ` — só você vê ${noun === 'personagem' ? 'este personagem' : 'este item'}. Marque para deixá-lo visível às outras pessoas do sistema.`}
          </span>
        </span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
