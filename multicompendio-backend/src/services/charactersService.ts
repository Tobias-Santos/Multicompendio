import { pool } from '../db/pool';
import * as charactersRepo from '../repositories/charactersRepository';
import * as attributesRepo from '../repositories/attributesRepository';
import { loadVisibleSystem } from './systemsService';
import { NotFoundError, ValidationError } from '../errors';
import { SystemAttribute } from '../types/system';
import {
  CharacterDetail,
  CharacterInput,
  CharacterSummary,
  CharacterValue,
  CharacterValues,
} from '../types/character';

const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 1000;
const MAX_LONGTEXT_LENGTH = 5000;

function validateName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name) throw new ValidationError('O personagem precisa de um nome.');
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }
  return name;
}

function isMissing(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');
}

// RF10 — confere os valores informados contra os atributos do sistema
// (obrigatórios, tipo, faixa de números, opções). Devolve só o que deve ser gravado.
function validateValues(
  attributes: SystemAttribute[],
  values: CharacterValues | undefined,
): Array<{ attributeId: string; value: CharacterValue }> {
  const input = (values ?? {}) as Record<string, unknown>;
  const known = new Set(attributes.map((a) => a.id));

  if (Object.keys(input).some((id) => !known.has(id))) {
    throw new ValidationError('Há um campo que não pertence ao sistema deste personagem.');
  }

  const entries: Array<{ attributeId: string; value: CharacterValue }> = [];

  for (const attr of attributes) {
    const raw = input[attr.id];

    if (isMissing(raw)) {
      if (attr.is_required) throw new ValidationError(`O campo "${attr.name}" é obrigatório.`);
      continue;
    }

    switch (attr.data_type) {
      case 'number': {
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          throw new ValidationError(`O campo "${attr.name}" precisa ser um número.`);
        }
        // o banco devolve colunas numéricas como texto, então converte antes de comparar
        const min = attr.min_value === null ? null : Number(attr.min_value);
        const max = attr.max_value === null ? null : Number(attr.max_value);
        if (min !== null && max !== null && (raw < min || raw > max)) {
          throw new ValidationError(`O campo "${attr.name}" precisa estar entre ${min} e ${max}.`);
        }
        if (min !== null && raw < min) {
          throw new ValidationError(`O campo "${attr.name}" precisa ser no mínimo ${min}.`);
        }
        if (max !== null && raw > max) {
          throw new ValidationError(`O campo "${attr.name}" precisa ser no máximo ${max}.`);
        }
        entries.push({ attributeId: attr.id, value: raw });
        break;
      }
      case 'text': {
        if (typeof raw !== 'string') {
          throw new ValidationError(`O campo "${attr.name}" precisa ser um texto.`);
        }
        const text = raw.trim();
        if (text.length > MAX_TEXT_LENGTH) {
          throw new ValidationError(
            `O campo "${attr.name}" pode ter no máximo ${MAX_TEXT_LENGTH} caracteres.`,
          );
        }
        entries.push({ attributeId: attr.id, value: text });
        break;
      }
      case 'longtext': {
        if (typeof raw !== 'string') {
          throw new ValidationError(`O campo "${attr.name}" precisa ser um texto.`);
        }
        const text = raw.trim();
        if (text.length > MAX_LONGTEXT_LENGTH) {
          throw new ValidationError(
            `O campo "${attr.name}" pode ter no máximo ${MAX_LONGTEXT_LENGTH} caracteres.`,
          );
        }
        entries.push({ attributeId: attr.id, value: text });
        break;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') {
          throw new ValidationError(`O campo "${attr.name}" precisa ser verdadeiro ou falso.`);
        }
        entries.push({ attributeId: attr.id, value: raw });
        break;
      }
      case 'select': {
        if (typeof raw !== 'string' || !(attr.options ?? []).includes(raw)) {
          throw new ValidationError(`Escolha uma das opções disponíveis em "${attr.name}".`);
        }
        entries.push({ attributeId: attr.id, value: raw });
        break;
      }
    }
  }

  return entries;
}

// Só o dono enxerga e altera o personagem; para os outros ele "não existe".
async function loadOwnCharacter(id: string, userId: string) {
  const record = await charactersRepo.findById(id);
  if (!record || record.owner_user_id !== userId) {
    throw new NotFoundError('Personagem não encontrado.');
  }
  return record;
}

// RF13 — lista os personagens do usuário em um sistema
export async function listCharacters(systemId: string, userId: string): Promise<CharacterSummary[]> {
  await loadVisibleSystem(systemId, userId);
  return charactersRepo.listBySystemAndOwner(systemId, userId);
}

// RF14 — abre um personagem (com os atributos do sistema, para montar o formulário)
export async function getCharacter(id: string, userId: string): Promise<CharacterDetail> {
  const record = await loadOwnCharacter(id, userId);
  const [attributes, values] = await Promise.all([
    attributesRepo.listAttributesBySystem(record.system_id),
    charactersRepo.getValues(id),
  ]);

  const { owner_user_id: _owner, ...character } = record;
  return { character, attributes, values };
}

// RF09, RF10, RF11, RF12 — cria um personagem em um sistema existente
export async function createCharacter(
  systemId: string,
  input: CharacterInput,
  userId: string,
): Promise<CharacterDetail> {
  await loadVisibleSystem(systemId, userId); // RF11: o sistema precisa existir e estar acessível
  const name = validateName(input.name);
  const attributes = await attributesRepo.listAttributesBySystem(systemId);
  const entries = validateValues(attributes, input.values);

  const client = await pool.connect();
  let characterId: string;
  try {
    await client.query('BEGIN');
    characterId = await charactersRepo.insertCharacter(client, systemId, userId, name);
    await charactersRepo.replaceValues(client, characterId, entries);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getCharacter(characterId, userId);
}

// RF15, RF16 — edita nome e valores e salva
export async function updateCharacter(
  id: string,
  input: CharacterInput,
  userId: string,
): Promise<CharacterDetail> {
  const record = await loadOwnCharacter(id, userId);
  const name = validateName(input.name);
  const attributes = await attributesRepo.listAttributesBySystem(record.system_id);
  const entries = validateValues(attributes, input.values);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await charactersRepo.updateName(client, id, name);
    await charactersRepo.replaceValues(client, id, entries);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getCharacter(id, userId);
}

export async function removeCharacter(id: string, userId: string): Promise<void> {
  await loadOwnCharacter(id, userId);
  await charactersRepo.deleteById(id);
}
