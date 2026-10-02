import { AttributeDataType } from '../types/system';

// Termos voltados ao usuário final — evitam jargão de programação
// (ex: "boolean", "select") tanto no dropdown de criação quanto na
// tabela de atributos.
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeDataType, string> = {
  number: 'Número',
  text: 'Texto',
  boolean: 'Verdadeiro ou falso',
  select: 'Lista de opções',
};

export const ATTRIBUTE_TYPE_ORDER: AttributeDataType[] = ['number', 'text', 'boolean', 'select'];

// Exemplo de nome de atributo coerente com cada tipo, usado no
// placeholder do campo "Nome" ao adicionar um atributo.
export const ATTRIBUTE_NAME_EXAMPLES: Record<AttributeDataType, string> = {
  number: 'Força',
  text: 'Biografia',
  boolean: 'Possui armadura',
  select: 'Classe',
};
