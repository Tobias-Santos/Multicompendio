import { CharacterDetail, CharacterInput, CharacterSummary } from '../types/character';
import { request } from './http';

export function listCharacters(systemId: string): Promise<CharacterSummary[]> {
  return request(`/systems/${systemId}/characters`);
}

export function createCharacter(systemId: string, input: CharacterInput): Promise<CharacterDetail> {
  return request(`/systems/${systemId}/characters`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCharacter(id: string): Promise<CharacterDetail> {
  return request(`/characters/${id}`);
}

export function updateCharacter(id: string, input: CharacterInput): Promise<CharacterDetail> {
  return request(`/characters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// Torna o personagem público (visível, só para leitura, às outras pessoas do sistema) ou privado.
export function setVisibility(id: string, isPublic: boolean): Promise<CharacterDetail> {
  return request(`/characters/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ is_public: isPublic }),
  });
}

export function deleteCharacter(id: string): Promise<void> {
  return request(`/characters/${id}`, { method: 'DELETE' });
}
