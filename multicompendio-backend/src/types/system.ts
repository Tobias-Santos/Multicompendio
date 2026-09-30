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

// Payload de entrada — usado tanto na criação (RF02) quanto na edição (RF05)
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

// Payload de criação — RF01. Só nome + descrição; o resto (versão,
// proprietário, pré-configurado, atributos) é preenchido depois, na
// página de edição do sistema.
export interface CreateSystemInput {
  name: string;
  description?: string;
}

// Payload de edição das propriedades do sistema — usado na página de
// edição, depois que o sistema já existe. `is_preconfigured` não é
// editável pelo usuário: só é definido pelo seed de instalação (RF04).
export interface UpdateSystemInput {
  description?: string;
  owner_user_id?: string;
  version?: string;
}
