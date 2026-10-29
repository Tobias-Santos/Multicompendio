import { pool } from '../db/pool';
import * as attributesRepo from '../repositories/attributesRepository';
import * as itemsRepo from '../repositories/itemsRepository';
import { createCharacter, removeCharacter } from './charactersService';
import { saveStory } from './storiesService';
import {
  EXAMPLE_CHARACTER_NAME,
  EXAMPLE_INVENTORY,
  EXAMPLE_STORY,
  EXAMPLE_SYSTEM_NAME_PREFIX,
  exampleValues,
} from '../data/exampleCharacter';

// Dá ao usuário a sua cópia do personagem de exemplo (ficha completa e história de origem) no
// sistema pré-configurado D&D. A cópia é um personagem comum: o usuário pode editar e excluir.
// Passa pelas mesmas validações de qualquer personagem, então um dado inválido aqui falha alto.
// Devolve o id do personagem criado, ou null se não havia o que criar (sem o sistema, ou o
// usuário já tem um personagem com esse nome nele).
export async function createExampleCharacter(userId: string): Promise<string | null> {
  const system = await pool.query<{ id: string }>(
    `SELECT id FROM rpg_systems
      WHERE is_preconfigured AND name ILIKE $1
      ORDER BY created_at LIMIT 1`,
    [`${EXAMPLE_SYSTEM_NAME_PREFIX}%`],
  );
  if (!system.rows[0]) return null; // banco sem o seed: nada a fazer
  const systemId = system.rows[0].id;

  const already = await pool.query(
    `SELECT 1 FROM characters WHERE owner_user_id = $1 AND system_id = $2 AND name = $3 LIMIT 1`,
    [userId, systemId, EXAMPLE_CHARACTER_NAME],
  );
  if (already.rows.length > 0) return null;

  const user = await pool.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [userId]);
  if (!user.rows[0]) return null;

  const attributes = await attributesRepo.listAttributesBySystem(systemId);
  const idByKey = new Map(attributes.map((a) => [a.key, a.id]));
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(exampleValues(user.rows[0].name))) {
    const id = idByKey.get(key);
    if (!id) throw new Error(`O personagem de exemplo usa o atributo "${key}", que não existe no sistema.`);
    values[id] = value;
  }

  const created = await createCharacter(systemId, { name: EXAMPLE_CHARACTER_NAME, values }, userId);
  const characterId = created.character.id;
  try {
    await saveStory(characterId, { content: EXAMPLE_STORY, base_revision: 0 }, userId);
  } catch (err) {
    await removeCharacter(characterId, userId); // não deixa um personagem sem a história pela metade
    throw err;
  }

  // o inventário usa os itens pré-instalados; sem eles (banco sem a migração dos itens), segue sem inventário
  const preinstalled = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM items WHERE system_id = $1 AND owner_user_id IS NULL`,
    [systemId],
  );
  const idByName = new Map(preinstalled.rows.map((r) => [r.name, r.id]));
  for (const [name, quantity] of EXAMPLE_INVENTORY) {
    const itemId = idByName.get(name);
    if (itemId) await itemsRepo.upsertInventory(characterId, itemId, quantity);
  }
  return characterId;
}
