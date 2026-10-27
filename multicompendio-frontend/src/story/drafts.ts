import { StoryDocument } from '../types/story';

// Rascunho local da história: cópia do que a pessoa digitou e ainda não foi confirmado
// pelo servidor. Existe para não perder texto se a conexão cair ou a aba fechar no meio.
// Só guarda o que não foi enviado: depois de salvar com sucesso, é apagado.

const PREFIX = 'multicompendio.rascunho-historia.';

export interface StoryDraft {
  content: StoryDocument;
  baseRevision: number; // revisão do servidor em que o texto se baseou
  savedAt: string;
}

export function readDraft(characterId: string): StoryDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + characterId);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoryDraft;
    return draft && draft.content && typeof draft.baseRevision === 'number' ? draft : null;
  } catch {
    return null; // armazenamento indisponível ou conteúdo corrompido
  }
}

export function writeDraft(characterId: string, draft: StoryDraft): void {
  try {
    localStorage.setItem(PREFIX + characterId, JSON.stringify(draft));
  } catch {
    // armazenamento cheio ou bloqueado: o salvamento no servidor continua funcionando
  }
}

export function clearDraft(characterId: string): void {
  try {
    localStorage.removeItem(PREFIX + characterId);
  } catch {
    // ignora
  }
}

// Ao sair da conta, não deixa texto de história para trás neste navegador.
export function clearAllDrafts(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignora
  }
}

// ---- Gravações pendentes ----
// Permite esperar o que ainda não foi salvo antes de uma ação que apaga a sessão (sair da conta).
const pending = new Set<() => Promise<void>>();

export function registerPending(flush: () => Promise<void>): () => void {
  pending.add(flush);
  return () => {
    pending.delete(flush);
  };
}

export async function flushAllPending(): Promise<void> {
  await Promise.allSettled([...pending].map((flush) => flush()));
}
