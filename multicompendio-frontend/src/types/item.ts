import { CharacterValues } from './character';
import { SystemAttribute } from './system';

// Itens e equipamentos (RF11, RF12). Os campos de um item são definidos pelo dono do sistema e
// formam também o bloco de estatísticas do item.

export interface ItemSummary {
  id: string;
  system_id: string;
  name: string;
  is_public: boolean;
  is_preinstalled: boolean; // já vem com o sistema pré-instalado (só leitura, de todos)
  is_mine: boolean;
  owner_name: string | null;
  values: CharacterValues;
  created_at: string;
  updated_at: string;
}

export interface ItemList {
  fields: SystemAttribute[];
  items: ItemSummary[];
}

export interface ItemDetail {
  item: {
    id: string;
    system_id: string;
    name: string;
    is_public: boolean;
    is_preinstalled: boolean;
    owner_name: string | null;
    system_name: string;
    system_is_preconfigured: boolean;
    can_edit: boolean; // só o dono edita
    created_at: string;
    updated_at: string;
  };
  fields: SystemAttribute[];
  values: CharacterValues;
}

export interface InventoryEntry {
  item_id: string;
  quantity: number;
  viewable: boolean; // falso: item privado de outra pessoa (só a quantidade aparece)
  name: string | null;
  owner_name: string | null;
  is_preinstalled: boolean;
  values: CharacterValues;
}

export interface Inventory {
  fields: SystemAttribute[];
  entries: InventoryEntry[];
}
