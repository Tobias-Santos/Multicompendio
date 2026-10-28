import { useEffect, useState } from 'react';
import { getStory } from '../api/storiesApi';
import { clearDraft, readDraft } from '../story/drafts';
import { sameStory } from '../story/sameStory';
import { InitialStory, StoryEditor } from './StoryEditor';
import { StoryReader } from './StoryReader';

type PanelState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; initial: InitialStory };

// Carrega a história salva, cruza com o rascunho local (se houver) e abre o editor.
interface Props {
  characterId: string;
  readOnly?: boolean; // história de outra pessoa (personagem público): só leitura
  ownerName?: string;
}

export function StoryPanel({ characterId, readOnly = false, ownerName }: Props) {
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    getStory(characterId)
      .then((story) => {
        if (cancelled) return;
        let draft = readOnly ? null : readDraft(characterId); // só quem escreve tem rascunho local
        // Rascunho igual ao que está salvo: a gravação já tinha chegado (ex.: ao fechar a aba, quando
        // não dá tempo de apagar o rascunho). Não há o que recuperar nem o que decidir.
        if (draft !== null && sameStory(draft.content, story.content)) {
          clearDraft(characterId);
          draft = null;
        }
        // Rascunho feito em cima da revisão que está salva: é texto que não chegou ao servidor, entra de volta.
        // Rascunho feito em cima de outra revisão: o servidor mudou nesse meio-tempo, a pessoa decide.
        const sameBase = draft !== null && draft.baseRevision === story.revision;
        setState({
          kind: 'ready',
          initial: {
            content: story.content,
            revision: story.revision,
            updatedAt: story.updated_at,
            recoveredDraft: sameBase && draft ? draft.content : null,
            conflictDraft: draft !== null && !sameBase ? draft.content : null,
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : 'Não foi possível carregar a história.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, attempt, readOnly]);

  if (state.kind === 'loading') return <p className="muted">Carregando a história…</p>;

  if (state.kind === 'error') {
    return (
      <div role="alert">
        <p className="error">{state.message}</p>
        <button type="button" className="ghost" onClick={() => setAttempt((n) => n + 1)}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <section className="card story-card" aria-labelledby="titulo-historia">
      <div className="card-header">
        <h2 id="titulo-historia">História de origem</h2>
      </div>
      {readOnly ? (
        <>
          <p className="muted story-hint">
            Esta história é {ownerName ? `de ${ownerName}` : 'de outra pessoa'} e está pública neste sistema: você pode lê-la,
            mas não editar.
          </p>
          <StoryReader content={state.initial.content} />
        </>
      ) : (
        <StoryEditor characterId={characterId} initial={state.initial} />
      )}
    </section>
  );
}
