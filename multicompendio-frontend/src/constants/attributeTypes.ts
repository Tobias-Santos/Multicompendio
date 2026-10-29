import { AttributeDataType } from '../types/system';

// Termos voltados ao usuário final — evitam jargão de programação
// (ex: "boolean", "select") tanto no dropdown de criação quanto na
// tabela de atributos.
export const ATTRIBUTE_TYPE_LABELS: Record<AttributeDataType, string> = {
  number: 'Número',
  text: 'Texto',
  longtext: 'Texto longo',
  boolean: 'Verdadeiro ou falso',
  select: 'Lista de opções',
  text_number: 'Texto com número',
};

export const ATTRIBUTE_TYPE_ORDER: AttributeDataType[] = ['number', 'text', 'longtext', 'text_number', 'boolean', 'select'];

// Tipos que têm uma parte numérica, com mínimo e máximo.
export const hasNumberRange = (type: AttributeDataType) => type === 'number' || type === 'text_number';

// Exemplo de nome de atributo coerente com cada tipo, usado no
// placeholder do campo "Nome" ao adicionar um atributo.
export const ATTRIBUTE_NAME_EXAMPLES: Record<AttributeDataType, string> = {
  number: 'Força',
  text: 'Apelido',
  longtext: 'Biografia',
  boolean: 'Possui armadura',
  select: 'Classe',
  text_number: 'Disciplina',
};

// Exemplos de nome para os campos dos itens (o que os itens de um sistema têm).
export const ITEM_FIELD_NAME_EXAMPLES: Record<AttributeDataType, string> = {
  number: 'Peso',
  text: 'Dano',
  longtext: 'Descrição',
  boolean: 'É mágico',
  select: 'Raridade',
  text_number: 'Encantamento',
};

// Agrupa atributos por seção, na ordem em que cada seção aparece pela primeira vez.
// Atributos sem seção ficam na chave '' (e só existe grupo se houver algum).
export function groupBySection<T extends { group_name: string | null }>(items: T[]): Array<{ section: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.group_name ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map, ([section, list]) => ({ section, items: list }));
}
