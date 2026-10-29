import { CharacterValues } from './character';
import { SystemAttribute } from './system';

// Itens e equipamentos (RF11, RF12). Os campos de um item são definidos pelo dono do sistema
// (mesmo formato dos atributos de personagem) e são também os campos do bloco de estatísticas.

// Como o banco devolve um item (uso interno do back-end).
export interface ItemRecord {
  id: string;
  system_id: string;
  owner_user_id: string | null; // nulo = item que já vem com o sistema pré-instalado
  owner_name: string | null;
  name: string;
  is_public: boolean;
  system_name: string;
  system_is_preconfigured: boolean;
  system_owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Item nas listas (com os valores, para mostrar um resumo do bloco).
export interface ItemSummary {
  id: string;
  system_id: string;
  name: string;
  is_public: boolean;
  is_preinstalled: boolean;
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
    can_edit: boolean; // só o dono edita; os itens pré-instalados e os de outras pessoas são só leitura
    created_at: string;
    updated_at: string;
  };
  fields: SystemAttribute[];
  values: CharacterValues;
}

export interface ItemInput {
  name: unknown;
  values?: CharacterValues;
}

export interface InventoryRow {
  item_id: string;
  quantity: number;
  name: string;
  owner_user_id: string | null;
  owner_name: string | null;
  is_public: boolean;
}

// Uma linha do inventário. Se quem lê não pode ver o item (privado de outra pessoa), `viewable` é
// falso e só a quantidade aparece.
export interface InventoryEntry {
  item_id: string;
  quantity: number;
  viewable: boolean;
  name: string | null;
  owner_name: string | null;
  is_preinstalled: boolean;
  values: CharacterValues;
}

export interface Inventory {
  fields: SystemAttribute[];
  entries: InventoryEntry[];
}
