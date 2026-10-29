import { CharacterInput } from '../types/character';
import { Inventory, ItemDetail, ItemList } from '../types/item';
import { request } from './http';

export function listItems(systemId: string): Promise<ItemList> {
  return request(`/systems/${systemId}/items`);
}

export function createItem(systemId: string, input: CharacterInput): Promise<ItemDetail> {
  return request(`/systems/${systemId}/items`, { method: 'POST', body: JSON.stringify(input) });
}

export function getItem(id: string): Promise<ItemDetail> {
  return request(`/items/${id}`);
}

export function updateItem(id: string, input: CharacterInput): Promise<ItemDetail> {
  return request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

// Público (as outras pessoas do sistema veem e usam, só para leitura) ou privado.
export function setItemVisibility(id: string, isPublic: boolean): Promise<ItemDetail> {
  return request(`/items/${id}/visibility`, { method: 'PUT', body: JSON.stringify({ is_public: isPublic }) });
}

export function deleteItem(id: string): Promise<void> {
  return request(`/items/${id}`, { method: 'DELETE' });
}

// ---- inventário do personagem ----
export function getInventory(characterId: string): Promise<Inventory> {
  return request(`/characters/${characterId}/items`);
}

export function setInventoryItem(characterId: string, itemId: string, quantity: number): Promise<Inventory> {
  return request(`/characters/${characterId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
}

export function removeInventoryItem(characterId: string, itemId: string): Promise<void> {
  return request(`/characters/${characterId}/items/${itemId}`, { method: 'DELETE' });
}
