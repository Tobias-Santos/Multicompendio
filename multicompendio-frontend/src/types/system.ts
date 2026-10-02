export type AttributeDataType = 'number' | 'text' | 'boolean' | 'select';

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
  created_at: string;
  updated_at: string;
}

export interface SystemAttribute {
  id: string;
  system_id: string;
  key: string; // identificador técnico interno — não exibido na interface
  name: string;
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
}

export interface ApiError {
  error: string;
}
