import { SystemAttribute } from './system';

// Valor de um campo "texto com número": o número é opcional.
export interface TextNumberValue {
  number: number | null;
  text: string;
}

export type CharacterValue = string | number | boolean | TextNumberValue;

// Chave: id do atributo do sistema
export type CharacterValues = Record<string, CharacterValue>;

// Item das listas: os personagens da pessoa e os públicos de outras pessoas do mesmo sistema.
export interface CharacterSummary {
  id: string;
  system_id: string;
  name: string;
  is_public: boolean;
  owner_name: string;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterDetail {
  character: {
    id: string;
    system_id: string;
    name: string;
    is_public: boolean;
    owner_name: string;
    system_name: string;
    system_is_preconfigured: boolean;
    can_edit: boolean; // false quando é o personagem público de outra pessoa (só leitura)
    created_at: string;
    updated_at: string;
  };
  attributes: SystemAttribute[];
  values: CharacterValues;
}

export interface CharacterInput {
  name: string;
  values: CharacterValues;
}
