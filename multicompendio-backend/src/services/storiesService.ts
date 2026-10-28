import * as storiesRepo from '../repositories/storiesRepository';
import { loadOwnCharacter, loadViewableCharacter } from './charactersService';
import { StaleRevisionError, ValidationError } from '../errors';
import { validateStoryDocument } from '../utils/storyDocument';
import { StoryRecord, StorySaveInput, StorySaveResult } from '../types/story';

// RF08 — abre a história do personagem (só o dono). Sem história ainda: revisão 0.
export async function getStory(characterId: string, userId: string): Promise<StoryRecord> {
  await loadViewableCharacter(characterId, userId); // quem vê o personagem público lê a história; só o dono grava
  const row = await storiesRepo.findByCharacter(characterId);
  if (!row) return { content: null, revision: 0, updated_at: null };
  return { content: row.content, revision: row.revision, updated_at: row.updated_at };
}

// RF08 — grava a história. O cliente informa a revisão em que se baseou (base_revision):
// se outra aba ou dispositivo gravou depois, a gravação é recusada com 409 e a revisão atual,
// em vez de apagar em silêncio o que a outra aba escreveu.
export async function saveStory(
  characterId: string,
  input: StorySaveInput,
  userId: string,
): Promise<StorySaveResult> {
  await loadOwnCharacter(characterId, userId);

  const base = input?.base_revision;
  if (typeof base !== 'number' || !Number.isInteger(base) || base < 0) {
    throw new ValidationError('A revisão da história é inválida.');
  }
  const content = validateStoryDocument(input?.content);

  const saved =
    base === 0
      ? await storiesRepo.insertFirst(characterId, content)
      : await storiesRepo.updateIfRevision(characterId, content, base);

  if (!saved) {
    throw new StaleRevisionError(
      'Esta história foi alterada em outra aba ou dispositivo depois da última vez que você a abriu.',
      await storiesRepo.currentRevision(characterId),
    );
  }
  return saved;
}
