import {
  AttributeInput,
  CreateSystemInput,
  RpgSystem,
  SystemAttribute,
  SystemWithAttributes,
  UpdateSystemInput,
} from '../types/system';
import { request } from './http';

export function listSystems(): Promise<RpgSystem[]> {
  return request('/systems');
}

export function getSystem(id: string): Promise<SystemWithAttributes> {
  return request(`/systems/${id}`);
}

// RF01 — cadastro simplificado (nome + descrição)
export function createSystem(input: CreateSystemInput): Promise<RpgSystem> {
  return request('/systems', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Edição das demais propriedades do sistema — feita na página do sistema
export function updateSystem(id: string, changes: UpdateSystemInput): Promise<RpgSystem> {
  return request(`/systems/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function deleteSystem(id: string): Promise<void> {
  return request(`/systems/${id}`, { method: 'DELETE' });
}

// Atributos de personagem e campos de item usam as mesmas chamadas; `kind` escolhe o caminho.
export type FieldKind = 'attribute' | 'item_field';
const fieldPath = (systemId: string, kind: FieldKind) =>
  `/systems/${systemId}/${kind === 'item_field' ? 'item-fields' : 'attributes'}`;

// RF02 + RF03 (atributos) e RF12 (campos de item) — adiciona ao sistema já existente
export function addAttribute(systemId: string, attr: AttributeInput, kind: FieldKind = 'attribute'): Promise<SystemAttribute> {
  return request(fieldPath(systemId, kind), {
    method: 'POST',
    body: JSON.stringify(attr),
  });
}

export function updateAttribute(
  systemId: string,
  attributeId: string,
  changes: Partial<AttributeInput>,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute> {
  return request(`${fieldPath(systemId, kind)}/${attributeId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function deleteAttribute(systemId: string, attributeId: string, kind: FieldKind = 'attribute'): Promise<void> {
  return request(`${fieldPath(systemId, kind)}/${attributeId}`, { method: 'DELETE' });
}
