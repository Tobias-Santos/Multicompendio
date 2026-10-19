import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { CharacterRecord, CharacterSummary, CharacterValue, CharacterValues } from '../types/character';

const SELECT_CHARACTER = `
  SELECT c.id, c.system_id, c.owner_user_id, c.name, c.created_at, c.updated_at,
         s.name AS system_name
    FROM characters c
    JOIN rpg_systems s ON s.id = c.system_id`;

export async function listBySystemAndOwner(
  systemId: string,
  ownerUserId: string,
): Promise<CharacterSummary[]> {
  const result = await pool.query<CharacterSummary>(
    `SELECT id, system_id, name, created_at, updated_at
       FROM characters
      WHERE system_id = $1 AND owner_user_id = $2
      ORDER BY lower(name), created_at`,
    [systemId, ownerUserId],
  );
  return result.rows;
}

export async function findById(id: string): Promise<CharacterRecord | null> {
  const result = await pool.query<CharacterRecord>(`${SELECT_CHARACTER} WHERE c.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function getValues(characterId: string): Promise<CharacterValues> {
  const result = await pool.query<{ attribute_id: string; value: CharacterValue }>(
    `SELECT attribute_id, value FROM character_values WHERE character_id = $1`,
    [characterId],
  );
  const values: CharacterValues = {};
  for (const row of result.rows) values[row.attribute_id] = row.value;
  return values;
}

export async function insertCharacter(
  client: PoolClient,
  systemId: string,
  ownerUserId: string,
  name: string,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO characters (system_id, owner_user_id, name) VALUES ($1, $2, $3) RETURNING id`,
    [systemId, ownerUserId, name],
  );
  return result.rows[0].id;
}

export async function updateName(client: PoolClient, id: string, name: string): Promise<void> {
  await client.query(`UPDATE characters SET name = $2 WHERE id = $1`, [id, name]);
}

// Substitui todos os valores do personagem pelos informados.
// Atributos não preenchidos (opcionais) simplesmente ficam sem linha.
export async function replaceValues(
  client: PoolClient,
  characterId: string,
  entries: Array<{ attributeId: string; value: CharacterValue }>,
): Promise<void> {
  await client.query(`DELETE FROM character_values WHERE character_id = $1`, [characterId]);
  for (const { attributeId, value } of entries) {
    // sempre JSON.stringify + ::jsonb: o driver não converte números/textos/booleanos soltos sozinho
    await client.query(
      `INSERT INTO character_values (character_id, attribute_id, value) VALUES ($1, $2, $3::jsonb)`,
      [characterId, attributeId, JSON.stringify(value)],
    );
  }
}

export async function deleteById(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM characters WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

// RF38 — quantos personagens usam este sistema
export async function countBySystem(systemId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM characters WHERE system_id = $1`,
    [systemId],
  );
  return Number(result.rows[0].total);
}

// Quantos personagens têm valor guardado para este atributo
export async function countValuesByAttribute(attributeId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM character_values WHERE attribute_id = $1`,
    [attributeId],
  );
  return Number(result.rows[0].total);
}
