import * as systemsRepo from '../repositories/systemsRepository';
import * as attributesRepo from '../repositories/attributesRepository';
import { uniqueSlug } from '../utils/slugify';
import {
  CreateSystemInput,
  UpdateSystemInput,
  AttributeInput,
  RpgSystem,
  SystemAttribute,
} from '../types/system';

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ConflictError extends Error {}

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

// RF01 — cadastro simplificado: só nome + descrição.
// Atributos e demais propriedades (versão, proprietário, pré-configurado)
// são adicionados depois, na página de edição do sistema.
export async function registerSystem(input: CreateSystemInput): Promise<RpgSystem> {
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError('O sistema precisa de um nome.');
  }

  const existing = await systemsRepo.findSystemByName(input.name);
  if (existing) {
    throw new ConflictError(`Já existe um sistema chamado "${input.name}".`);
  }

  return systemsRepo.insertSystem(input);
}

export async function getSystem(id: string): Promise<{ system: RpgSystem; attributes: SystemAttribute[] }> {
  const system = await systemsRepo.findSystemById(id);
  if (!system) throw new NotFoundError('Sistema não encontrado.');
  const attributes = await attributesRepo.listAttributesBySystem(id);
  return { system, attributes };
}

export async function listAllSystems(): Promise<RpgSystem[]> {
  return systemsRepo.listSystems();
}

// Edição das propriedades do próprio sistema (versão, proprietário,
// descrição, pré-configurado) — feita na página de edição.
export async function updateSystem(id: string, changes: UpdateSystemInput): Promise<RpgSystem> {
  const current = await systemsRepo.findSystemById(id);
  if (!current) throw new NotFoundError('Sistema não encontrado.');

  const updated = await systemsRepo.updateSystemById(id, changes);
  if (!updated) throw new NotFoundError('Sistema não encontrado.');
  return updated;
}

// RF06
export async function removeSystem(id: string): Promise<void> {
  const system = await systemsRepo.findSystemById(id);
  if (!system) throw new NotFoundError('Sistema não encontrado.');
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
): Promise<SystemAttribute> {
  const system = await systemsRepo.findSystemById(systemId);
  if (!system) throw new NotFoundError('Sistema não encontrado.');

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
export async function removeAttribute(systemId: string, attributeId: string): Promise<void> {
  const current = await attributesRepo.findAttributeById(systemId, attributeId);
  if (!current) throw new NotFoundError('Atributo não encontrado neste sistema.');
  await attributesRepo.deleteAttributeById(attributeId);
}

// RF05 — edição de um atributo específico do sistema
export async function editAttribute(
  systemId: string,
  attributeId: string,
  changes: Partial<AttributeInput>,
): Promise<SystemAttribute> {
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
