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

export function deleteCharacter(id: string): Promise<void> {
  return request(`/characters/${id}`, { method: 'DELETE' });
}
