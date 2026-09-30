import * as systemsRepo from '../repositories/systemsRepository';
import * as attributesRepo from '../repositories/attributesRepository';
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
  if (attr.data_type === 'select' && (!attr.options || attr.options.length === 0)) {
    throw new ValidationError(`Atributo "${attr.key}" é do tipo select mas não tem opções.`);
  }
  if (
    attr.min_value !== undefined &&
    attr.max_value !== undefined &&
    attr.min_value > attr.max_value
  ) {
    throw new ValidationError(`Atributo "${attr.key}": min_value maior que max_value.`);
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

  return systemsRepo.insertSystem(input.name, input.description);
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
export async function addAttribute(
  systemId: string,
  attr: AttributeInput,
): Promise<SystemAttribute> {
  const system = await systemsRepo.findSystemById(systemId);
  if (!system) throw new NotFoundError('Sistema não encontrado.');

  if (!attr.key || !attr.label) {
    throw new ValidationError('Todo atributo precisa de key e label.');
  }
  validateAttributeShape(attr);

  const existingAttrs = await attributesRepo.listAttributesBySystem(systemId);
  if (existingAttrs.some((a) => a.key === attr.key)) {
    throw new ValidationError(`Já existe um atributo com a key "${attr.key}" neste sistema.`);
  }

  return attributesRepo.insertAttribute(systemId, attr);
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
    key: current.key,
    label: changes.label ?? current.label,
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
