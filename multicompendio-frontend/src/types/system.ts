export type AttributeDataType = 'number' | 'text' | 'boolean' | 'select';

export interface RpgSystem {
  id: string;
  name: string;
  description: string | null;
  owner_user_id: string | null;
  version: string | null;
  is_preconfigured: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemAttribute {
  id: string;
  system_id: string;
  key: string;
  label: string;
  data_type: AttributeDataType;
  default_value: string | null;
  min_value: number | null;
  max_value: number | null;
  options: string[] | null;
  is_required: boolean;
  display_order: number;
}

export interface AttributeInput {
  key: string;
  label: string;
  data_type: AttributeDataType;
  default_value?: string;
  min_value?: number;
  max_value?: number;
  options?: string[];
  is_required?: boolean;
  display_order?: number;
}

// RF01 — cadastro simplificado: só nome + descrição.
export interface CreateSystemInput {
  name: string;
  description?: string;
}

// Edição das demais propriedades, feita na página do sistema.
// is_preconfigured não entra aqui: só é definido pelo seed de instalação (RF04).
export interface UpdateSystemInput {
  description?: string;
  owner_user_id?: string;
  version?: string;
}

export interface SystemWithAttributes {
  system: RpgSystem;
  attributes: SystemAttribute[];
}

export interface ApiError {
  error: string;
}
