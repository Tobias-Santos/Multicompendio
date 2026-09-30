import {
  AttributeInput,
  CreateSystemInput,
  RpgSystem,
  SystemAttribute,
  SystemWithAttributes,
  UpdateSystemInput,
} from '../types/system';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // resposta sem corpo JSON (ex: 204) — mantém a mensagem padrão
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

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
