import { pool } from '../db/pool';
import { StoryDocument } from '../types/story';

interface StoryRow {
  content: StoryDocument;
  revision: number;
  updated_at: string;
}

export async function findByCharacter(characterId: string): Promise<StoryRow | null> {
  const result = await pool.query<StoryRow>(
    `SELECT content, revision, updated_at FROM character_stories WHERE character_id = $1`,
    [characterId],
  );
  return result.rows[0] ?? null;
}

// Primeira gravação (revisão 1). Devolve null se já existe uma história: outra aba
// gravou primeiro, e quem chamou deve tratar como revisão desatualizada.
export async function insertFirst(
  characterId: string,
  content: StoryDocument,
): Promise<{ revision: number; updated_at: string } | null> {
  const result = await pool.query<{ revision: number; updated_at: string }>(
    `INSERT INTO character_stories (character_id, content)
          VALUES ($1, $2::jsonb)
     ON CONFLICT (character_id) DO NOTHING
       RETURNING revision, updated_at`,
    [characterId, JSON.stringify(content)],
  );
  return result.rows[0] ?? null;
}

// Grava só se a revisão no banco ainda é a esperada (em uma única instrução, sem corrida).
// Devolve null se a revisão mudou nesse meio-tempo.
export async function updateIfRevision(
  characterId: string,
  content: StoryDocument,
  expectedRevision: number,
): Promise<{ revision: number; updated_at: string } | null> {
  const result = await pool.query<{ revision: number; updated_at: string }>(
    `UPDATE character_stories
        SET content = $2::jsonb, revision = revision + 1
      WHERE character_id = $1 AND revision = $3
  RETURNING revision, updated_at`,
    [characterId, JSON.stringify(content), expectedRevision],
  );
  return result.rows[0] ?? null;
}

export async function currentRevision(characterId: string): Promise<number> {
  const result = await pool.query<{ revision: number }>(
    `SELECT revision FROM character_stories WHERE character_id = $1`,
    [characterId],
  );
  return result.rows[0]?.revision ?? 0;
}
