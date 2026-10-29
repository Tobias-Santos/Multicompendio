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
  owner_name: string | null; // nome de quem criou; vazio nos sistemas que já vêm com o app
  can_edit: boolean;         // se quem está logado pode alterar este sistema
  is_member: boolean;        // se entrou neste sistema por convite (não é o dono)
  created_at: string;
  updated_at: string;
}

export interface SystemAttribute {
  id: string;
  system_id: string;
  key: string; // identificador técnico interno — não exibido na interface
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

// Sem `key`: a aplicação gera esse identificador automaticamente a
// partir do nome informado pelo usuário.
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

// RF01 — cadastro: nome, descrição e metadados narrativos.
export interface CreateSystemInput {
  name: string;
  description?: string;
  language?: string;
  genre?: string;
  setting?: string;
  image_url?: string;
}

// Edição das demais propriedades, feita na página do sistema.
// is_preconfigured e owner_user_id não entram aqui: o primeiro só é
// definido pelo seed de instalação (RF04), o segundo será atribuído
// automaticamente pelo backend quando a autenticação existir.
export interface UpdateSystemInput {
  description?: string;
  version?: string;
  language?: string;
  genre?: string;
  setting?: string;
  image_url?: string;
}

export interface SystemWithAttributes {
  system: RpgSystem;
  attributes: SystemAttribute[];
  item_fields: SystemAttribute[]; // campos que os itens deste sistema têm
}

export interface ApiError {
  error: string;
}
