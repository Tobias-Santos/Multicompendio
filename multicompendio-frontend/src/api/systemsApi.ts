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

// RF02 + RF03 — adiciona um atributo a um sistema já existente
export function addAttribute(systemId: string, attr: AttributeInput): Promise<SystemAttribute> {
  return request(`/systems/${systemId}/attributes`, {
    method: 'POST',
    body: JSON.stringify(attr),
  });
}

export function updateAttribute(
  systemId: string,
  attributeId: string,
  changes: Partial<AttributeInput>,
): Promise<SystemAttribute> {
  return request(`/systems/${systemId}/attributes/${attributeId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function deleteAttribute(systemId: string, attributeId: string): Promise<void> {
  return request(`/systems/${systemId}/attributes/${attributeId}`, { method: 'DELETE' });
}
