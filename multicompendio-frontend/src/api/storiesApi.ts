import { StoryDocument, StoryRecord, StorySaveResult } from '../types/story';
import { request } from './http';

export function getStory(characterId: string): Promise<StoryRecord> {
  return request(`/characters/${characterId}/story`);
}

// `baseRevision` é a revisão em que o texto se baseou: se outra aba gravou depois,
// o servidor recusa com 409 em vez de sobrescrever.
// `keepalive` deixa a requisição terminar mesmo se a aba estiver sendo fechada.
export function saveStory(
  characterId: string,
  content: StoryDocument,
  baseRevision: number,
  keepalive = false,
): Promise<StorySaveResult> {
  const body = JSON.stringify({ content, base_revision: baseRevision });
  // os navegadores limitam o corpo de requisições keepalive a ~64 KB; acima disso, envia normalmente
  const canKeepAlive = keepalive && new TextEncoder().encode(body).length < 60000;
  return request(`/characters/${characterId}/story`, { method: 'PUT', body, keepalive: canKeepAlive });
}
