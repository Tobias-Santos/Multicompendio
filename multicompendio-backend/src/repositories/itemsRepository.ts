import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { CharacterValue, CharacterValues } from '../types/character';
import { InventoryRow, ItemRecord } from '../types/item';

const SELECT_ITEM = `
  SELECT i.id, i.system_id, i.owner_user_id, i.name, i.is_public, i.created_at, i.updated_at,
         s.name AS system_name, s.is_preconfigured AS system_is_preconfigured,
         s.owner_user_id AS system_owner_user_id, u.name AS owner_name
    FROM items i
    JOIN rpg_systems s ON s.id = i.system_id
    LEFT JOIN users u ON u.id = i.owner_user_id`;

export async function findById(id: string): Promise<ItemRecord | null> {
  const result = await pool.query<ItemRecord>(`${SELECT_ITEM} WHERE i.id = $1`, [id]);
  return result.rows[0] ?? null;
}

// Os itens do sistema que a pessoa pode ver: os dela, os pré-instalados e, nos sistemas de pessoas,
// os que outras pessoas deixaram públicos (quem chama já confirmou que ela está no sistema).
export async function listVisibleInSystem(systemId: string, userId: string): Promise<ItemRecord[]> {
  const result = await pool.query<ItemRecord>(
    `${SELECT_ITEM}
      WHERE i.system_id = $1
        AND (i.owner_user_id IS NULL OR i.owner_user_id = $2 OR (i.is_public AND NOT s.is_preconfigured))
      ORDER BY (i.owner_user_id = $2) DESC NULLS LAST, (i.owner_user_id IS NULL), lower(i.name), i.created_at`,
    [systemId, userId],
  );
  return result.rows;
}

export async function getValues(itemId: string): Promise<CharacterValues> {
  return (await getValuesFor([itemId])).get(itemId) ?? {};
}

export async function getValuesFor(itemIds: string[]): Promise<Map<string, CharacterValues>> {
  const map = new Map<string, CharacterValues>();
  if (itemIds.length === 0) return map;
  const result = await pool.query<{ item_id: string; field_id: string; value: CharacterValue }>(
    `SELECT item_id, field_id, value FROM item_values WHERE item_id = ANY($1::uuid[])`,
    [itemIds],
  );
  for (const row of result.rows) {
    const values = map.get(row.item_id) ?? {};
    values[row.field_id] = row.value;
    map.set(row.item_id, values);
  }
  return map;
}

export async function insertItem(client: PoolClient, systemId: string, ownerUserId: string, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO items (system_id, owner_user_id, name) VALUES ($1, $2, $3) RETURNING id`,
    [systemId, ownerUserId, name],
  );
  return result.rows[0].id;
}

export async function updateName(client: PoolClient, id: string, name: string): Promise<void> {
  await client.query(`UPDATE items SET name = $2 WHERE id = $1`, [id, name]);
}

export async function replaceValues(
  client: PoolClient,
  itemId: string,
  entries: Array<{ attributeId: string; value: CharacterValue }>,
): Promise<void> {
  await client.query(`DELETE FROM item_values WHERE item_id = $1`, [itemId]);
  for (const { attributeId, value } of entries) {
    await client.query(`INSERT INTO item_values (item_id, field_id, value) VALUES ($1, $2, $3::jsonb)`, [
      itemId,
      attributeId,
      JSON.stringify(value),
    ]);
  }
}

export async function setPublic(id: string, isPublic: boolean): Promise<void> {
  await pool.query(`UPDATE items SET is_public = $2 WHERE id = $1`, [id, isPublic]);
}

export async function deleteItem(id: string): Promise<void> {
  await pool.query(`DELETE FROM items WHERE id = $1`, [id]);
}

// ---- contagens usadas pelas regras de exclusão e de visibilidade ----
const count = async (sql: string, params: unknown[]): Promise<number> =>
  Number((await pool.query<{ total: string }>(sql, params)).rows[0].total);

export const countBySystem = (systemId: string) =>
  count(`SELECT count(*) AS total FROM items WHERE system_id = $1`, [systemId]);

export const countByOwnerInSystem = (systemId: string, userId: string) =>
  count(`SELECT count(*) AS total FROM items WHERE system_id = $1 AND owner_user_id = $2`, [systemId, userId]);

export const countValuesByField = (fieldId: string) =>
  count(`SELECT count(*) AS total FROM item_values WHERE field_id = $1`, [fieldId]);

// em quantos inventários o item está
export const countInventoryUse = (itemId: string) =>
  count(`SELECT count(*) AS total FROM character_items WHERE item_id = $1`, [itemId]);

// em quantos inventários de personagens de OUTRAS pessoas o item está
export const countInventoryUseByOthers = (itemId: string, ownerUserId: string) =>
  count(
    `SELECT count(*) AS total FROM character_items ci JOIN characters c ON c.id = ci.character_id
      WHERE ci.item_id = $1 AND c.owner_user_id <> $2`,
    [itemId, ownerUserId],
  );

// ---- inventário ----
export async function listInventory(characterId: string): Promise<InventoryRow[]> {
  const result = await pool.query<InventoryRow>(
    `SELECT ci.item_id, ci.quantity, i.name, i.owner_user_id, i.is_public, u.name AS owner_name
       FROM character_items ci
       JOIN items i ON i.id = ci.item_id
       LEFT JOIN users u ON u.id = i.owner_user_id
      WHERE ci.character_id = $1
      ORDER BY lower(i.name), ci.added_at`,
    [characterId],
  );
  return result.rows;
}

export async function upsertInventory(characterId: string, itemId: string, quantity: number): Promise<void> {
  await pool.query(
    `INSERT INTO character_items (character_id, item_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (character_id, item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
    [characterId, itemId, quantity],
  );
}

export async function removeInventory(characterId: string, itemId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM character_items WHERE character_id = $1 AND item_id = $2`, [
    characterId,
    itemId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

// Quantos valores já guardados ficariam fora de uma nova faixa (mínimo/máximo; nulo = sem limite).
// Vale para o tipo número e para a parte numérica do tipo "texto com número".
export async function countValuesOutOfRange(attributeId: string, min: number | null, max: number | null): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM (
       SELECT CASE WHEN jsonb_typeof(value) = 'object' THEN value->'number' ELSE value END AS n
         FROM item_values WHERE field_id = $1
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
    `SELECT count(*) AS total FROM item_values
      WHERE field_id = $1 AND jsonb_typeof(value) = 'string' AND NOT ((value #>> '{}') = ANY($2::text[]))`,
    [attributeId, options],
  );
  return Number(result.rows[0].total);
}
