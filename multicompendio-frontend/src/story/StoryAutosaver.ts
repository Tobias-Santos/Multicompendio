import { ApiError, getToken } from '../api/http';
import { getStory, saveStory } from '../api/storiesApi';
import { StoryDocument } from '../types/story';
import { clearDraft, registerPending, writeDraft } from './drafts';

// Salvamento automático da história de origem (RF08).
//
// Como funciona:
//  - cada alteração do usuário marca o texto como "não salvo" e agenda uma gravação para
//    DEBOUNCE_MS depois da última tecla; se a pessoa não parar de digitar, grava mesmo assim a
//    cada MAX_WAIT_MS;
//  - nunca há duas gravações ao mesmo tempo; se o texto mudou durante uma gravação, a próxima
//    sai logo em seguida, já com a revisão nova;
//  - antes de cada gravação, e a cada pausa curta, uma cópia fica no navegador (rascunho local),
//    apagada quando o servidor confirma;
//  - se a conexão cair ou o servidor falhar, tenta de novo com espera crescente (e na hora em que
//    o navegador voltar a ficar online);
//  - se outra aba ou dispositivo gravou antes (revisão diferente), PARA de gravar e pergunta à
//    pessoa qual versão manter, em vez de sobrescrever em silêncio;
//  - sai da página, troca de aba ou fecha: grava o que faltar com `keepalive`.

const DEBOUNCE_MS = 1500;
const MAX_WAIT_MS = 10000;
const DRAFT_MS = 400;
const RETRY_MS = [2000, 4000, 8000, 15000, 30000];

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'retrying' | 'conflict' | 'invalid';

export interface AutosaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
  message: string | null; // explicação para 'retrying', 'invalid' e 'conflict'
}

export interface AutosaverOptions {
  characterId: string;
  revision: number; // revisão que o servidor tinha ao abrir
  savedAt: Date | null;
  startDirty: boolean; // abriu com um rascunho recuperado, ainda por enviar
  conflictDraft: StoryDocument | null; // rascunho antigo de uma revisão que o servidor já ultrapassou
  getDoc: () => StoryDocument;
  replaceDoc: (doc: StoryDocument | null) => void; // troca o texto do editor sem contar como edição
}

export class StoryAutosaver {
  private revision: number;
  private serverRevision: number;
  private version = 0; // sobe a cada alteração
  private savedVersion = 0; // última `version` confirmada pelo servidor
  private inFlight = false;
  private flushQueued = false;
  private retryCount = 0;
  private conflictMine: StoryDocument | null;
  private started = false;

  private debounceTimer?: number;
  private maxWaitTimer?: number;
  private retryTimer?: number;
  private draftTimer?: number;
  private unregister?: () => void;

  private state: AutosaveState;
  private listeners = new Set<() => void>();

  constructor(private o: AutosaverOptions) {
    this.revision = o.revision;
    this.serverRevision = o.revision;
    this.conflictMine = o.conflictDraft;
    if (o.conflictDraft) {
      this.state = {
        status: 'conflict',
        lastSavedAt: o.savedAt,
        message: 'Há um rascunho neste navegador baseado em uma versão mais antiga da história.',
      };
    } else {
      this.state = { status: o.startDirty ? 'dirty' : 'saved', lastSavedAt: o.savedAt, message: null };
      if (o.startDirty) this.version = 1;
    }
  }

  // ---- assinatura (para o React ler o estado) ----
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = (): AutosaveState => this.state;

  private set(patch: Partial<AutosaveState>): void {
    const next = { ...this.state, ...patch };
    if (
      next.status === this.state.status &&
      next.message === this.state.message &&
      next.lastSavedAt === this.state.lastSavedAt
    ) {
      return;
    }
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  // ---- ciclo de vida (pode iniciar e parar várias vezes: o React em modo estrito faz isso) ----
  start(): void {
    if (this.started) return;
    this.started = true;
    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.unregister = registerPending(() => this.flushAndWait());
    if (this.state.status === 'dirty') this.debounceTimer = window.setTimeout(() => void this.flush(false), 800);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.writeDraftNow();
    void this.flush(true); // o que faltar sai antes de a tela sumir
    window.clearTimeout(this.debounceTimer);
    window.clearTimeout(this.maxWaitTimer);
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.draftTimer);
    this.maxWaitTimer = undefined;
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.unregister?.();
  }

  // ---- chamadas pelo editor ----
  // O editor avisa a cada alteração feita pela pessoa.
  notifyChange(): void {
    this.version++;
    this.persistDraftSoon();
    if (this.state.status === 'conflict') return; // nada é enviado até a pessoa decidir
    this.set({ status: this.inFlight ? 'saving' : 'dirty', message: null });
    this.schedule();
  }

  // Salvar agora (botão, Ctrl+S, ao sair do editor)
  saveNow(): void {
    void this.flush(false);
  }

  // ---- decisão em caso de conflito ----
  // Mantém o texto desta aba e sobrescreve o que está salvo.
  keepMine(): void {
    if (this.state.status !== 'conflict') return;
    if (this.conflictMine) {
      this.o.replaceDoc(this.conflictMine);
      this.conflictMine = null;
    }
    this.revision = this.serverRevision;
    this.version++;
    this.set({ status: 'dirty', message: null });
    void this.flush(false);
  }

  // Descarta o texto desta aba e passa a usar o que está salvo.
  async adoptServerVersion(): Promise<void> {
    if (this.state.status !== 'conflict') return;
    this.set({ status: 'saving', message: null });
    try {
      const saved = await getStory(this.o.characterId);
      this.revision = saved.revision;
      this.serverRevision = saved.revision;
      this.conflictMine = null;
      this.o.replaceDoc(saved.content);
      this.version++;
      this.savedVersion = this.version;
      clearDraft(this.o.characterId);
      this.set({
        status: 'saved',
        lastSavedAt: saved.updated_at ? new Date(saved.updated_at) : null,
        message: null,
      });
    } catch {
      this.set({ status: 'conflict', message: 'Não foi possível carregar a versão salva. Tente de novo.' });
    }
  }

  // ---- gravação ----
  private schedule(): void {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => void this.flush(false), DEBOUNCE_MS);
    if (this.maxWaitTimer === undefined) {
      this.maxWaitTimer = window.setTimeout(() => void this.flush(false), MAX_WAIT_MS);
    }
  }

  private hasUnsaved(): boolean {
    return this.inFlight || this.version !== this.savedVersion;
  }

  private async flush(keepalive: boolean): Promise<void> {
    window.clearTimeout(this.debounceTimer);
    window.clearTimeout(this.maxWaitTimer);
    this.maxWaitTimer = undefined;

    if (this.state.status === 'conflict') return;
    if (this.inFlight) {
      this.flushQueued = true;
      return;
    }
    if (this.version === this.savedVersion) return;
    if (!getToken()) return; // sem sessão (ex.: acabou de sair da conta): o rascunho local fica guardado

    window.clearTimeout(this.retryTimer);
    const snapshot = this.version;
    const doc = this.o.getDoc();
    this.inFlight = true;
    this.writeDraftNow(doc); // a cópia local vale até o servidor confirmar
    this.set({ status: 'saving', message: null });

    try {
      const result = await saveStory(this.o.characterId, doc, this.revision, keepalive);
      this.revision = result.revision;
      this.serverRevision = result.revision;
      this.savedVersion = snapshot;
      this.retryCount = 0;
      this.inFlight = false;
      const savedAt = new Date(result.updated_at);

      if (this.version === snapshot) {
        window.clearTimeout(this.draftTimer);
        clearDraft(this.o.characterId);
        this.set({ status: 'saved', lastSavedAt: savedAt, message: null });
      } else {
        // a pessoa continuou escrevendo durante a gravação: o que veio depois ainda não foi enviado
        this.set({ status: 'dirty', lastSavedAt: savedAt, message: null });
        this.schedule();
      }
      if (this.flushQueued) {
        this.flushQueued = false;
        void this.flush(false);
      }
    } catch (err) {
      this.inFlight = false;
      this.flushQueued = false;
      this.handleError(err);
    }
  }

  private handleError(err: unknown): void {
    if (err instanceof ApiError) {
      const body = err.body as { code?: string; revision?: number } | null;
      if (err.status === 409 && body?.code === 'stale_revision') {
        // outra aba ou dispositivo gravou antes: não sobrescreve nada sem a pessoa decidir
        this.serverRevision = typeof body.revision === 'number' ? body.revision : this.serverRevision;
        this.set({ status: 'conflict', message: err.message });
        return;
      }
      if (err.status === 401) {
        this.set({
          status: 'retrying',
          message: 'Sua sessão terminou. O que você escreveu está guardado neste navegador; entre de novo para continuar.',
        });
        return;
      }
      if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        // o servidor recusou o texto (ex.: passou do limite): repetir não adianta
        this.set({ status: 'invalid', message: err.message });
        return;
      }
    }
    // sem conexão, servidor fora do ar, limite de requisições: tenta de novo com espera crescente
    this.set({
      status: 'retrying',
      message: 'Não foi possível salvar agora. O texto está guardado neste navegador e será enviado assim que der.',
    });
    const delay = RETRY_MS[Math.min(this.retryCount, RETRY_MS.length - 1)];
    this.retryCount++;
    this.retryTimer = window.setTimeout(() => void this.flush(false), delay);
  }

  // Espera o que está pendente terminar (usado antes de sair da conta).
  async flushAndWait(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      if (this.state.status === 'conflict' || !this.hasUnsaved()) return;
      if (this.inFlight) await new Promise((resolve) => window.setTimeout(resolve, 100));
      else await this.flush(false);
    }
  }

  // ---- rascunho local ----
  private persistDraftSoon(): void {
    window.clearTimeout(this.draftTimer);
    this.draftTimer = window.setTimeout(() => this.writeDraftNow(), DRAFT_MS);
  }

  private writeDraftNow(doc?: StoryDocument): void {
    if (this.version === this.savedVersion && !this.inFlight) return; // nada a guardar
    writeDraft(this.o.characterId, {
      content: doc ?? this.o.getDoc(),
      baseRevision: this.revision, // em conflito continua a revisão antiga: assim o conflito reaparece ao reabrir
      savedAt: new Date().toISOString(),
    });
  }

  // ---- eventos do navegador ----
  private onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.hasUnsaved()) return;
    this.writeDraftNow();
    void this.flush(true);
    event.preventDefault(); // o navegador avisa que há alterações sendo enviadas
    event.returnValue = '';
  };

  private onPageHide = (): void => {
    this.writeDraftNow();
    void this.flush(true);
  };

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      this.writeDraftNow();
      void this.flush(true);
    }
  };

  private onOnline = (): void => {
    if (this.state.status === 'retrying') {
      this.retryCount = 0;
      void this.flush(false);
    }
  };
}
