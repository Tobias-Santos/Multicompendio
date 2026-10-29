import { pool } from '../db/pool';
import * as attributesRepo from '../repositories/attributesRepository';
import * as itemsRepo from '../repositories/itemsRepository';
import * as sharingRepo from '../repositories/sharingRepository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { CharacterValues } from '../types/character';
import { Inventory, ItemDetail, ItemInput, ItemList, ItemRecord, ItemSummary } from '../types/item';
import { loadOwnCharacter, loadViewableCharacter, validateValues } from './charactersService';
import { loadVisibleSystem } from './systemsService';

// Itens e equipamentos (RF11) e o inventário dos personagens.
//  - cada pessoa cria os próprios itens num sistema que ela enxerga (dela, de convite ou o D&D);
//  - o item é privado por padrão; o dono pode torná-lo público, e aí as outras pessoas do sistema
//    o veem e o usam, só para leitura (nos sistemas pré-instalados os itens de pessoas são sempre
//    privados, porque o sistema é de todos);
//  - os itens pré-instalados (sem dono) são de todos e só leitura;
//  - um item que está em algum inventário não é excluído, e um item público que está no inventário
//    de outra pessoa não volta a ser privado.

const MAX_NAME_LENGTH = 120;
const MAX_QUANTITY = 9999;

function validateName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) throw new ValidationError('O item precisa de um nome.');
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }
  return name;
}

const countOf = (total: number, singular: string, plural: string) => `${total} ${total === 1 ? singular : plural}`;

// A pessoa participa do sistema do item (é a dona ou entrou por convite)?
async function inSystem(record: Pick<ItemRecord, 'system_id' | 'system_owner_user_id'>, userId: string): Promise<boolean> {
  return record.system_owner_user_id === userId || (await sharingRepo.isMember(record.system_id, userId));
}

// Quem pode VER um item: o dono; todos, se é pré-instalado; ou, se o dono o deixou público, quem
// participa do sistema. Para quem não pode, ele "não existe".
async function canView(record: ItemRecord, userId: string): Promise<boolean> {
  if (record.owner_user_id === userId || record.owner_user_id === null) return true;
  return record.is_public && !record.system_is_preconfigured && (await inSystem(record, userId));
}

export async function loadViewableItem(id: string, userId: string): Promise<ItemRecord> {
  const record = await itemsRepo.findById(id);
  if (!record || !(await canView(record, userId))) throw new NotFoundError('Item não encontrado.');
  return record;
}

async function loadOwnItem(id: string, userId: string): Promise<ItemRecord> {
  const record = await loadViewableItem(id, userId);
  if (record.owner_user_id === null) {
    throw new ForbiddenError('Este item já vem com o Multicompêndio e é somente para consulta.');
  }
  if (record.owner_user_id !== userId) throw new NotFoundError('Item não encontrado.');
  return record;
}

function toSummary(record: ItemRecord, values: CharacterValues, userId: string): ItemSummary {
  return {
    id: record.id,
    system_id: record.system_id,
    name: record.name,
    is_public: record.is_public,
    is_preinstalled: record.owner_user_id === null,
    is_mine: record.owner_user_id === userId,
    owner_name: record.owner_name,
    values,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

// RF11 — lista os itens do sistema que a pessoa pode ver
export async function listItems(systemId: string, userId: string): Promise<ItemList> {
  await loadVisibleSystem(systemId, userId);
  const [fields, records] = await Promise.all([
    attributesRepo.listAttributesBySystem(systemId, 'item_field'),
    itemsRepo.listVisibleInSystem(systemId, userId),
  ]);
  const values = await itemsRepo.getValuesFor(records.map((r) => r.id));
  return { fields, items: records.map((r) => toSummary(r, values.get(r.id) ?? {}, userId)) };
}

export async function getItem(id: string, userId: string): Promise<ItemDetail> {
  const record = await loadViewableItem(id, userId);
  const [fields, values] = await Promise.all([
    attributesRepo.listAttributesBySystem(record.system_id, 'item_field'),
    itemsRepo.getValues(id),
  ]);
  return {
    item: {
      id: record.id,
      system_id: record.system_id,
      name: record.name,
      is_public: record.is_public,
      is_preinstalled: record.owner_user_id === null,
      owner_name: record.owner_name,
      system_name: record.system_name,
      system_is_preconfigured: record.system_is_preconfigured,
      can_edit: record.owner_user_id === userId,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    fields,
    values,
  };
}

// RF11 — cria um item (privado) no sistema
export async function createItem(systemId: string, input: ItemInput, userId: string): Promise<ItemDetail> {
  await loadVisibleSystem(systemId, userId);
  const name = validateName(input?.name);
  const fields = await attributesRepo.listAttributesBySystem(systemId, 'item_field');
  const entries = validateValues(fields, input?.values, 'deste item');

  const client = await pool.connect();
  let itemId: string;
  try {
    await client.query('BEGIN');
    itemId = await itemsRepo.insertItem(client, systemId, userId, name);
    await itemsRepo.replaceValues(client, itemId, entries);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getItem(itemId, userId);
}

// RF11 — edita um item (só o dono)
export async function updateItem(id: string, input: ItemInput, userId: string): Promise<ItemDetail> {
  const record = await loadOwnItem(id, userId);
  const name = validateName(input?.name);
  const fields = await attributesRepo.listAttributesBySystem(record.system_id, 'item_field');
  const entries = validateValues(fields, input?.values, 'deste item');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await itemsRepo.updateName(client, id, name);
    await itemsRepo.replaceValues(client, id, entries);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return getItem(id, userId);
}

// Público (as outras pessoas do sistema veem e usam, só para leitura) ou privado.
export async function setItemVisibility(id: string, isPublic: unknown, userId: string): Promise<ItemDetail> {
  const record = await loadOwnItem(id, userId);
  if (typeof isPublic !== 'boolean') throw new ValidationError('Informe se o item fica público ou privado.');
  if (isPublic && record.system_is_preconfigured) {
    throw new ValidationError(
      'Os itens que você cria no sistema pré-instalado são sempre privados, porque esse sistema é de todos. Crie ou entre em um sistema próprio para compartilhar itens.',
    );
  }
  if (!isPublic && record.is_public) {
    const others = await itemsRepo.countInventoryUseByOthers(id, userId);
    if (others > 0) {
      throw new ConflictError(
        `Este item está no inventário de ${countOf(others, 'personagem', 'personagens')} de outras pessoas, então não pode voltar a ser privado.`,
      );
    }
  }
  await itemsRepo.setPublic(id, isPublic);
  return getItem(id, userId);
}

// RF11 — exclui um item que não está em nenhum inventário
export async function removeItem(id: string, userId: string): Promise<void> {
  await loadOwnItem(id, userId);
  const inUse = await itemsRepo.countInventoryUse(id);
  if (inUse > 0) {
    throw new ConflictError(
      `Este item está no inventário de ${countOf(inUse, 'personagem', 'personagens')} e não pode ser excluído. Remova-o dos inventários primeiro.`,
    );
  }
  try {
    await itemsRepo.deleteItem(id);
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      throw new ConflictError('Este item está em uso e não pode ser excluído.');
    }
    throw err;
  }
}

// ---------------------------------------------------------------- inventário

// O inventário de um personagem que a pessoa pode ver. Itens privados de outra pessoa aparecem só
// como quantidade ("item privado"), sem nome nem campos.
export async function getInventory(characterId: string, userId: string): Promise<Inventory> {
  const character = await loadViewableCharacter(characterId, userId);
  const [fields, rows] = await Promise.all([
    attributesRepo.listAttributesBySystem(character.system_id, 'item_field'),
    itemsRepo.listInventory(characterId),
  ]);
  const viewerInSystem =
    character.system_owner_user_id === userId || (await sharingRepo.isMember(character.system_id, userId));

  const visible = (row: (typeof rows)[number]) =>
    row.owner_user_id === null ||
    row.owner_user_id === userId ||
    (row.is_public && !character.system_is_preconfigured && viewerInSystem);

  const values = await itemsRepo.getValuesFor(rows.filter(visible).map((r) => r.item_id));
  return {
    fields,
    entries: rows.map((row) => {
      const viewable = visible(row);
      return {
        item_id: row.item_id,
        quantity: row.quantity,
        viewable,
        name: viewable ? row.name : null,
        owner_name: viewable ? row.owner_name : null,
        is_preinstalled: row.owner_user_id === null,
        values: viewable ? values.get(row.item_id) ?? {} : {},
      };
    }),
  };
}

// Põe um item no inventário do personagem (só o dono do personagem) ou muda a quantidade.
export async function setInventoryItem(
  characterId: string,
  itemId: string,
  quantity: unknown,
  userId: string,
): Promise<Inventory> {
  const character = await loadOwnCharacter(characterId, userId);
  const item = await loadViewableItem(itemId, userId);
  if (item.system_id !== character.system_id) {
    throw new ValidationError('Este item é de outro sistema e não cabe no inventário deste personagem.');
  }
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new ValidationError(`A quantidade precisa ser um número inteiro entre 1 e ${MAX_QUANTITY}.`);
  }
  await itemsRepo.upsertInventory(characterId, itemId, quantity);
  return getInventory(characterId, userId);
}

export async function removeInventoryItem(characterId: string, itemId: string, userId: string): Promise<void> {
  await loadOwnCharacter(characterId, userId);
  if (!(await itemsRepo.removeInventory(characterId, itemId))) {
    throw new NotFoundError('Este item não está no inventário do personagem.');
  }
}
