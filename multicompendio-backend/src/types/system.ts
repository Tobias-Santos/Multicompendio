// 'longtext' = texto de várias linhas (histórias, anotações, listas de magias)
export type AttributeDataType = 'number' | 'text' | 'longtext' | 'boolean' | 'select';

export interface RpgSystem {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string | null;
  version: string | null;
  language: string | null;
  genre: string | null;
  setting: string | null;
  image_url: string | null;
  is_preconfigured: boolean;
  owner_name: string | null; // nome do proprietário (vem do cadastro de usuários)
  created_at: string;
  updated_at: string;
}

// O que a API devolve ao front: o sistema + se quem está pedindo pode alterá-lo.
export interface SystemView extends RpgSystem {
  can_edit: boolean;
}

export interface SystemAttribute {
  id: string;
  system_id: string;
  key: string; // identificador técnico interno — gerado pela aplicação, nunca pelo usuário
  name: string;
  group_name: string | null; // seção da ficha em que o atributo aparece (ex.: "Combate")
  data_type: AttributeDataType;
  default_value: string | null;
  min_value: number | null;
  max_value: number | null;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
}

// Payload de entrada — usado tanto na criação (RF02) quanto na edição (RF05).
// Não tem `key`: a aplicação gera esse identificador automaticamente a
// partir do nome, o usuário nunca precisa pensar nisso.
export interface AttributeInput {
  name: string;
  group_name?: string; // seção (opcional); texto vazio remove o atributo da seção
  data_type: AttributeDataType;
  default_value?: string;
  min_value?: number;
  max_value?: number;
  options?: string[];
  is_required?: boolean;
  display_order?: number;
}

// Payload de criação — RF01. Nome, descrição e os metadados narrativos
// (idioma, gênero, ambientação, imagem). Versão, proprietário e
// pré-configurado continuam de fora — preenchidos depois, na página
// de edição do sistema.
export interface CreateSystemInput {
  name: string;
  description?: string;
  language?: string;
  genre?: string;
  setting?: string;
  image_url?: string;
}

// Payload de edição das propriedades do sistema — usado na página de
// edição, depois que o sistema já existe.
// `is_preconfigured` e `owner_user_id` não entram aqui: o primeiro só é
// definido pelo seed de instalação (RF04), o segundo deve ser atribuído
// automaticamente pelo backend a partir do usuário autenticado, quando
// a autenticação existir — nunca digitado manualmente pelo usuário.
export interface UpdateSystemInput {
  description?: string;
  version?: string;
  language?: string;
  genre?: string;
  setting?: string;
  image_url?: string;
}
