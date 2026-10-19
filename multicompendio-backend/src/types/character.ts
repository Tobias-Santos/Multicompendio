import { SystemAttribute } from './system';

// Valor de um atributo para um personagem (guardado como JSONB)
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

export interface CharacterRecord extends CharacterSummary {
  owner_user_id: string;
  system_name: string;
}

// O que a API devolve ao abrir um personagem: ele, os atributos do sistema
// (para montar o formulário) e os valores já preenchidos.
export interface CharacterDetail {
  character: CharacterSummary & { system_name: string };
  attributes: SystemAttribute[];
  values: CharacterValues;
}

export interface CharacterInput {
  name: string;
  values?: CharacterValues;
}
