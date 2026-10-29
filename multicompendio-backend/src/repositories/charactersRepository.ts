import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { CharacterRecord, CharacterSummary, CharacterValue, CharacterValues } from '../types/character';

const SELECT_CHARACTER = `
  SELECT c.id, c.system_id, c.owner_user_id, c.name, c.is_public, c.created_at, c.updated_at,
         s.name AS system_name, s.is_preconfigured AS system_is_preconfigured,
         s.owner_user_id AS system_owner_user_id, u.name AS owner_name
    FROM characters c
    JOIN rpg_systems s ON s.id = c.system_id
    JOIN users u ON u.id = c.owner_user_id`;

// Os personagens do usuário no sistema e os públicos das outras pessoas dele. Nos sistemas
// pré-configurados (que são de todos) ninguém enxerga o personagem de ninguém.
export async function listVisibleInSystem(systemId: string, userId: string): Promise<CharacterSummary[]> {
  const result = await pool.query<CharacterSummary>(
    `SELECT c.id, c.system_id, c.name, c.is_public, u.name AS owner_name,
            (c.owner_user_id = $2) AS is_mine, c.created_at, c.updated_at
       FROM characters c
       JOIN rpg_systems s ON s.id = c.system_id
       JOIN users u ON u.id = c.owner_user_id
      WHERE c.system_id = $1
        AND (c.owner_user_id = $2 OR (c.is_public AND NOT s.is_preconfigured))
      ORDER BY (c.owner_user_id = $2) DESC, lower(c.name), c.created_at`,
    [systemId, userId],
  );
  return result.rows;
}

export async function setPublic(id: string, isPublic: boolean): Promise<void> {
  await pool.query(`UPDATE characters SET is_public = $2 WHERE id = $1`, [id, isPublic]);
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

// Quantos valores já guardados ficariam fora de uma nova faixa (mínimo/máximo; nulo = sem limite).
// Vale para o tipo número e para a parte numérica do tipo "texto com número".
export async function countValuesOutOfRange(attributeId: string, min: number | null, max: number | null): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM (
       SELECT CASE WHEN jsonb_typeof(value) = 'object' THEN value->'number' ELSE value END AS n
         FROM character_values WHERE attribute_id = $1
     ) v
      WHERE jsonb_typeof(v.n) = 'number'
        AND (($2::numeric IS NOT NULL AND (v.n #>> '{}')::numeric < $2::numeric)
          OR ($3::numeric IS NOT NULL AND (v.n #>> '{}')::numeric > $3::numeric))`,
    [attributeId, min, max],
  );
  return Number(result.rows[0].total);
}

// Quantos valores já guardados usam uma opção que não está na nova lista.
export async function countValuesNotInOptions(attributeId: string, options: string[]): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM character_values
      WHERE attribute_id = $1 AND jsonb_typeof(value) = 'string' AND NOT ((value #>> '{}') = ANY($2::text[]))`,
    [attributeId, options],
  );
  return Number(result.rows[0].total);
}
