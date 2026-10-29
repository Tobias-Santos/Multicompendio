import * as systemsRepo from '../repositories/systemsRepository';
import * as attributesRepo from '../repositories/attributesRepository';
import * as charactersRepo from '../repositories/charactersRepository';
import { uniqueSlug } from '../utils/slugify';
import {
  CreateSystemInput,
  UpdateSystemInput,
  AttributeInput,
  RpgSystem,
  SystemAttribute,
  SystemView,
} from '../types/system';
import * as sharingRepo from '../repositories/sharingRepository';
import * as itemsRepo from '../repositories/itemsRepository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';

// ------------------------------------------------------------------
// Posse e permissões (RF37):
//  - o usuário vê os sistemas pré-configurados, os que ele criou e os em que entrou por convite;
//  - só o proprietário altera ou exclui o que é dele (quem entrou por convite só consulta e cria
//    personagens);
//  - sistemas pré-configurados são somente para consulta.
// ------------------------------------------------------------------
async function isVisible(system: RpgSystem, userId: string): Promise<boolean> {
  if (system.is_preconfigured || system.owner_user_id === userId) return true;
  return sharingRepo.isMember(system.id, userId);
}

function toView(system: RpgSystem, userId: string, isMember = false): SystemView {
  return { ...system, can_edit: !system.is_preconfigured && system.owner_user_id === userId, is_member: isMember };
}

export async function loadVisibleSystem(id: string, userId: string): Promise<RpgSystem> {
  const system = await systemsRepo.findSystemById(id);
  // Sistema de outra pessoa é tratado como inexistente: não revela que ele existe.
  if (!system || !(await isVisible(system, userId))) throw new NotFoundError('Sistema não encontrado.');
  return system;
}

async function loadEditableSystem(id: string, userId: string): Promise<RpgSystem> {
  const system = await loadVisibleSystem(id, userId);
  if (system.is_preconfigured || system.owner_user_id !== userId) {
    throw new ForbiddenError('Este sistema é somente para consulta e não pode ser alterado.');
  }
  return system;
}

function validateAttributeShape(attr: AttributeInput | Partial<AttributeInput>): void {
  const name = attr.name ?? 'atributo';
  if (attr.data_type === 'select' && (!attr.options || attr.options.length === 0)) {
    throw new ValidationError(`O atributo "${name}" é do tipo "Lista de opções" mas não tem opções definidas.`);
  }
  if (
    attr.min_value !== undefined &&
    attr.max_value !== undefined &&
    attr.min_value > attr.max_value
  ) {
    throw new ValidationError(`O atributo "${name}" tem o valor mínimo maior que o valor máximo.`);
  }
}

// RF01 — cadastro do sistema. O proprietário é quem está com a sessão aberta.
// Atributos e versão são preenchidos depois, na página do sistema.
export async function registerSystem(input: CreateSystemInput, userId: string): Promise<SystemView> {
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('O sistema precisa de um nome.');
  }

  const existing = await systemsRepo.findVisibleSystemByName(input.name, userId);
  if (existing) {
    throw new ConflictError(`Já existe um sistema chamado "${input.name.trim()}".`);
  }

  try {
    return toView(await systemsRepo.insertSystem(input, userId), userId);
  } catch (err) {
    // duas requisições simultâneas com o mesmo nome: o índice único segura a segunda
    if ((err as { code?: string }).code === '23505') {
      throw new ConflictError(`Já existe um sistema chamado "${input.name.trim()}".`);
    }
    throw err;
  }
}

export async function getSystem(
  id: string,
  userId: string,
): Promise<{ system: SystemView; attributes: SystemAttribute[]; item_fields: SystemAttribute[] }> {
  const system = await loadVisibleSystem(id, userId);
  const [attributes, item_fields] = await Promise.all([
    attributesRepo.listAttributesBySystem(id),
    attributesRepo.listAttributesBySystem(id, 'item_field'),
  ]);
  const isMember = system.owner_user_id !== userId && !system.is_preconfigured && (await sharingRepo.isMember(id, userId));
  return { system: toView(system, userId, isMember), attributes, item_fields };
}

export async function listAllSystems(userId: string): Promise<SystemView[]> {
  const [systems, memberOf] = await Promise.all([
    systemsRepo.listVisibleSystems(userId),
    sharingRepo.listMembershipSystemIds(userId),
  ]);
  return systems.map((system) => toView(system, userId, memberOf.has(system.id)));
}

// Edição das propriedades do próprio sistema (versão, descrição, idioma,
// gênero, ambientação, imagem) — feita na página do sistema.
export async function updateSystem(
  id: string,
  changes: UpdateSystemInput,
  userId: string,
): Promise<SystemView> {
  await loadEditableSystem(id, userId);

  const updated = await systemsRepo.updateSystemById(id, changes);
  if (!updated) throw new NotFoundError('Sistema não encontrado.');
  return toView(updated, userId);
}

// "1 personagem" / "3 personagens"
function countOf(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`;
}

// RF06 + RF38 — só exclui um sistema que não tem personagens
export async function removeSystem(id: string, userId: string): Promise<void> {
  await loadEditableSystem(id, userId);

  const characters = await charactersRepo.countBySystem(id);
  if (characters > 0) {
    throw new ConflictError(
      `Este sistema não pode ser excluído porque tem ${countOf(characters, 'personagem', 'personagens')}. ` +
        'Exclua os personagens primeiro.',
    );
  }

  const items = await itemsRepo.countBySystem(id);
  if (items > 0) {
    throw new ConflictError(
      `Este sistema não pode ser excluído porque tem ${countOf(items, 'item', 'itens')}. Exclua os itens primeiro.`,
    );
  }

  try {
    await systemsRepo.deleteSystemById(id);
  } catch (err) {
    // segunda barreira: o banco também recusa se um personagem surgiu entre a checagem e a exclusão
    if ((err as { code?: string }).code === '23503') {
      throw new ConflictError('Este sistema não pode ser excluído porque ainda tem personagens ou itens.');
    }
    throw err;
  }
}

const MAX_GROUP_NAME_LENGTH = 80;

// Seção do atributo: aparada, e vazia vira "sem seção".
function normalizeGroupName(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const group = String(raw).trim();
  if (group.length > MAX_GROUP_NAME_LENGTH) {
    throw new ValidationError(`O nome da seção pode ter no máximo ${MAX_GROUP_NAME_LENGTH} caracteres.`);
  }
  return group;
}

// RF02 + RF03 — adiciona um atributo a um sistema já existente,
// validando a consistência mínima daquele atributo antes de gravar.
//
// A `key` (identificador técnico interno) é gerada aqui automaticamente
// a partir do nome — o usuário só informa o nome, nunca a key.
// Atributos de personagem e campos de item seguem as mesmas regras; o que muda é a tabela, a
// contagem de uso e as palavras das mensagens.
export type FieldKind = attributesRepo.FieldKind;

const FIELD_KIND = {
  attribute: {
    noun: 'atributo',
    Noun: 'Atributo',
    plural: 'personagens',
    existing: 'as fichas existentes',
    uses: ['personagem usa', 'personagens usam'] as const,
    pending: 'fichas',
    countRecords: (systemId: string) => charactersRepo.countBySystem(systemId),
    countValues: (id: string) => charactersRepo.countValuesByAttribute(id),
  },
  item_field: {
    noun: 'campo',
    Noun: 'Campo',
    plural: 'itens',
    existing: 'os itens existentes',
    uses: ['item usa', 'itens usam'] as const,
    pending: 'itens',
    countRecords: (systemId: string) => itemsRepo.countBySystem(systemId),
    countValues: (id: string) => itemsRepo.countValuesByField(id),
  },
};

// RF02 + RF03 (atributos de personagem) e RF12 (campos de item): adiciona ao sistema
export async function addAttribute(
  systemId: string,
  attr: AttributeInput,
  userId: string,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute> {
  const w = FIELD_KIND[kind];
  await loadEditableSystem(systemId, userId);

  if (!attr.name || !attr.name.trim()) {
    throw new ValidationError(`Todo ${w.noun} precisa de um nome.`);
  }
  validateAttributeShape(attr);

  // Um campo obrigatório novo deixaria sem ele o que já existe (inclusive de outras pessoas, quando
  // o sistema é compartilhado), então só entra enquanto não há personagens ou itens.
  if (attr.is_required && (await w.countRecords(systemId)) > 0) {
    throw new ConflictError(
      `Este sistema já tem ${w.plural}, então não dá para criar um ${w.noun} obrigatório: ${w.existing} ficariam sem esse campo. Crie o ${w.noun} como opcional.`,
    );
  }

  const existing = await attributesRepo.listAttributesBySystem(systemId, kind);
  const normalizedName = attr.name.trim().toLowerCase();
  if (existing.some((a) => a.name.trim().toLowerCase() === normalizedName)) {
    throw new ValidationError(`Já existe um ${w.noun} chamado "${attr.name}" neste sistema.`);
  }

  const key = uniqueSlug(attr.name, existing.map((a) => a.key));

  return attributesRepo.insertAttribute(
    systemId,
    key,
    { ...attr, name: attr.name.trim(), group_name: normalizeGroupName(attr.group_name) },
    kind,
  );
}

export async function removeAttribute(
  systemId: string,
  attributeId: string,
  userId: string,
  kind: FieldKind = 'attribute',
): Promise<void> {
  const w = FIELD_KIND[kind];
  await loadEditableSystem(systemId, userId);
  const current = await attributesRepo.findAttributeById(systemId, attributeId, kind);
  if (!current) throw new NotFoundError(`${w.Noun} não encontrado neste sistema.`);

  const inUse = await w.countValues(attributeId);
  if (inUse > 0) {
    throw new ConflictError(
      `O ${w.noun} "${current.name}" não pode ser excluído porque ${countOf(inUse, w.uses[0], w.uses[1])} esse ${w.noun}.`,
    );
  }

  try {
    await attributesRepo.deleteAttributeById(attributeId, kind);
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      throw new ConflictError(`O ${w.noun} "${current.name}" não pode ser excluído porque está em uso.`);
    }
    throw err;
  }
}

export async function editAttribute(
  systemId: string,
  attributeId: string,
  changes: Partial<AttributeInput>,
  userId: string,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute> {
  const w = FIELD_KIND[kind];
  await loadEditableSystem(systemId, userId);
  const current = await attributesRepo.findAttributeById(systemId, attributeId, kind);
  if (!current) throw new NotFoundError(`${w.Noun} não encontrado neste sistema.`);

  if (changes.data_type && changes.data_type !== current.data_type) {
    const inUse = await w.countValues(attributeId);
    if (inUse > 0) {
      throw new ConflictError(
        `O tipo do ${w.noun} "${current.name}" não pode ser alterado porque ${countOf(inUse, w.uses[0], w.uses[1])} esse ${w.noun}.`,
      );
    }
  }

  if (changes.name !== undefined) {
    const newName = changes.name.trim();
    if (!newName) throw new ValidationError(`Todo ${w.noun} precisa de um nome.`);
    const siblings = await attributesRepo.listAttributesBySystem(systemId, kind);
    if (siblings.some((a) => a.id !== attributeId && a.name.trim().toLowerCase() === newName.toLowerCase())) {
      throw new ValidationError(`Já existe um ${w.noun} chamado "${newName}" neste sistema.`);
    }
    changes = { ...changes, name: newName };
  }

  if (changes.group_name !== undefined) {
    changes = { ...changes, group_name: normalizeGroupName(changes.group_name) };
  }

  // Tornar obrigatório um campo existente só vale se tudo o que já existe o preenche.
  if (changes.is_required === true && !current.is_required) {
    const total = await w.countRecords(systemId);
    if (total > 0 && (await w.countValues(attributeId)) < total) {
      throw new ConflictError(
        `O ${w.noun} "${current.name}" não pode ser obrigatório porque há ${w.pending} que ainda não o preenchem.`,
      );
    }
  }

  const merged: AttributeInput = {
    name: changes.name ?? current.name,
    data_type: changes.data_type ?? current.data_type,
    default_value: changes.default_value ?? current.default_value ?? undefined,
    min_value: changes.min_value ?? current.min_value ?? undefined,
    max_value: changes.max_value ?? current.max_value ?? undefined,
    options: changes.options ?? current.options ?? undefined,
    is_required: changes.is_required ?? current.is_required,
    display_order: changes.display_order ?? current.display_order,
  };
  validateAttributeShape(merged);

  const updated = await attributesRepo.updateAttribute(attributeId, changes, kind);
  if (!updated) throw new NotFoundError(`${w.Noun} não encontrado.`);
  return updated;
}
