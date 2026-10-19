import { SystemAttribute } from './system';

export type CharacterValue = string | number | boolean;

// Chave: id do atributo do sistema
export type CharacterValues = Record<string, CharacterValue>;

export interface CharacterSummary {
  id: string;
  system_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterDetail {
  character: CharacterSummary & { system_name: string };
  attributes: SystemAttribute[];
  values: CharacterValues;
}

export interface CharacterInput {
  name: string;
  values: CharacterValues;
}
