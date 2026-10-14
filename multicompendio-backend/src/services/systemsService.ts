import * as systemsRepo from '../repositories/systemsRepository';
import * as attributesRepo from '../repositories/attributesRepository';
import { uniqueSlug } from '../utils/slugify';
import {
  CreateSystemInput,
  UpdateSystemInput,
  AttributeInput,
  RpgSystem,
  SystemAttribute,
  SystemView,
} from '../types/system';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';

// ------------------------------------------------------------------
// Posse e permissões (RF37):
//  - o usuário vê os sistemas pré-configurados e os que ele mesmo criou;
//  - só o proprietário altera ou exclui o que é dele;
//  - sistemas pré-configurados são somente para consulta.
// ------------------------------------------------------------------
function isVisible(system: RpgSystem, userId: string): boolean {
  return system.is_preconfigured || system.owner_user_id === userId;
}

function toView(system: RpgSystem, userId: string): SystemView {
  return { ...system, can_edit: !system.is_preconfigured && system.owner_user_id === userId };
}

async function loadVisibleSystem(id: string, userId: string): Promise<RpgSystem> {
  const system = await systemsRepo.findSystemById(id);
  // Sistema de outra pessoa é tratado como inexistente: não revela que ele existe.
  if (!system || !isVisible(system, userId)) throw new NotFoundError('Sistema não encontrado.');
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
): Promise<{ system: SystemView; attributes: SystemAttribute[] }> {
  const system = await loadVisibleSystem(id, userId);
  const attributes = await attributesRepo.listAttributesBySystem(id);
  return { system: toView(system, userId), attributes };
}

export async function listAllSystems(userId: string): Promise<SystemView[]> {
  const systems = await systemsRepo.listVisibleSystems(userId);
  return systems.map((system) => toView(system, userId));
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

// RF06
export async function removeSystem(id: string, userId: string): Promise<void> {
  await loadEditableSystem(id, userId);
  await systemsRepo.deleteSystemById(id);
}

// RF02 + RF03 — adiciona um atributo a um sistema já existente,
// validando a consistência mínima daquele atributo antes de gravar.
//
// A `key` (identificador técnico interno) é gerada aqui automaticamente
// a partir do nome — o usuário só informa o nome, nunca a key.
export async function addAttribute(
  systemId: string,
  attr: AttributeInput,
  userId: string,
): Promise<SystemAttribute> {
  await loadEditableSystem(systemId, userId);

  if (!attr.name || !attr.name.trim()) {
    throw new ValidationError('Todo atributo precisa de um nome.');
  }
  validateAttributeShape(attr);

  const existingAttrs = await attributesRepo.listAttributesBySystem(systemId);
  const normalizedName = attr.name.trim().toLowerCase();
  if (existingAttrs.some((a) => a.name.trim().toLowerCase() === normalizedName)) {
    throw new ValidationError(`Já existe um atributo chamado "${attr.name}" neste sistema.`);
  }

  const key = uniqueSlug(attr.name, existingAttrs.map((a) => a.key));

  return attributesRepo.insertAttribute(systemId, key, attr);
}

// Exclusão de um atributo específico do sistema
export async function removeAttribute(
  systemId: string,
  attributeId: string,
  userId: string,
): Promise<void> {
  await loadEditableSystem(systemId, userId);
  const current = await attributesRepo.findAttributeById(systemId, attributeId);
  if (!current) throw new NotFoundError('Atributo não encontrado neste sistema.');
  await attributesRepo.deleteAttributeById(attributeId);
}

// RF05 — edição de um atributo específico do sistema
export async function editAttribute(
  systemId: string,
  attributeId: string,
  changes: Partial<AttributeInput>,
  userId: string,
): Promise<SystemAttribute> {
  await loadEditableSystem(systemId, userId);
  const current = await attributesRepo.findAttributeById(systemId, attributeId);
  if (!current) throw new NotFoundError('Atributo não encontrado neste sistema.');

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

  const updated = await attributesRepo.updateAttribute(attributeId, changes);
  if (!updated) throw new NotFoundError('Atributo não encontrado.');
  return updated;
}
