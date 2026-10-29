import { pool } from '../db/pool';
import { AttributeInput, SystemAttribute } from '../types/system';

// Os campos dos itens têm o mesmo formato dos atributos de personagem e ficam em outra tabela;
// as mesmas funções servem aos dois, escolhendo a tabela por `kind`.
export type FieldKind = 'attribute' | 'item_field';
const TABLE: Record<FieldKind, string> = { attribute: 'system_attributes', item_field: 'system_item_fields' };

// Atributos agora são adicionados um de cada vez (na página de edição do
// sistema), então uma inserção simples via pool basta — não precisa mais
// de transação/PoolClient como quando tudo era criado junto no cadastro.
//
// `key` é gerado pela camada de serviço (slugify do nome) e passado aqui
// já pronto — o usuário nunca fornece isso.
export async function insertAttribute(
  systemId: string,
  key: string,
  attr: AttributeInput,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute> {
  const result = await pool.query<SystemAttribute>(
    `INSERT INTO ${TABLE[kind]}
       (system_id, key, name, group_name, data_type, default_value, min_value, max_value, options, is_required, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      systemId,
      key,
      attr.name,
      attr.group_name || null,
      attr.data_type,
      attr.default_value ?? null,
      attr.min_value ?? null,
      attr.max_value ?? null,
      attr.options ? JSON.stringify(attr.options) : null,
      attr.is_required ?? false,
      attr.display_order ?? 0,
    ],
  );
  return result.rows[0];
}

export async function listAttributesBySystem(
  systemId: string,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute[]> {
  const result = await pool.query<SystemAttribute>(
    `SELECT * FROM ${TABLE[kind]} WHERE system_id = $1 ORDER BY display_order, created_at, id`,
    [systemId],
  );
  return result.rows;
}

export async function findAttributeById(
  systemId: string,
  attributeId: string,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute | null> {
  const result = await pool.query<SystemAttribute>(
    `SELECT * FROM ${TABLE[kind]} WHERE id = $1 AND system_id = $2`,
    [attributeId, systemId],
  );
  return result.rows[0] ?? null;
}

// RF05 — edição de atributos específicos do sistema
export async function updateAttribute(
  attributeId: string,
  attr: Partial<AttributeInput>,
  kind: FieldKind = 'attribute',
): Promise<SystemAttribute | null> {
  const result = await pool.query<SystemAttribute>(
    `UPDATE ${TABLE[kind]} SET
       name          = COALESCE($2, name),
       data_type     = COALESCE($3, data_type),
       default_value = COALESCE($4, default_value),
       min_value     = COALESCE($5, min_value),
       max_value     = COALESCE($6, max_value),
       options       = COALESCE($7, options),
       is_required   = COALESCE($8, is_required),
       display_order = COALESCE($9, display_order),
       -- undefined mantém a seção atual; texto vazio tira o atributo da seção
       group_name    = CASE WHEN $10::text IS NULL THEN group_name WHEN $10::text = '' THEN NULL ELSE $10::text END
     WHERE id = $1
     RETURNING *`,
    [
      attributeId,
      attr.name,
      attr.data_type,
      attr.default_value,
      attr.min_value,
      attr.max_value,
      attr.options ? JSON.stringify(attr.options) : null,
      attr.is_required,
      attr.display_order,
      attr.group_name,
    ],
  );
  return result.rows[0] ?? null;
}

// Exclusão de um atributo específico do sistema
export async function deleteAttributeById(id: string, kind: FieldKind = 'attribute'): Promise<boolean> {
  const result = await pool.query(`DELETE FROM ${TABLE[kind]} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
