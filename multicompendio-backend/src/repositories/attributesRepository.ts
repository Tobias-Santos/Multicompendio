import { pool } from '../db/pool';
import { AttributeInput, SystemAttribute } from '../types/system';

// Atributos agora são adicionados um de cada vez (na página de edição do
// sistema), então uma inserção simples via pool basta — não precisa mais
// de transação/PoolClient como quando tudo era criado junto no cadastro.
export async function insertAttribute(
  systemId: string,
  attr: AttributeInput,
): Promise<SystemAttribute> {
  const result = await pool.query<SystemAttribute>(
    `INSERT INTO system_attributes
       (system_id, key, label, data_type, default_value, min_value, max_value, options, is_required, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      systemId,
      attr.key,
      attr.label,
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

export async function listAttributesBySystem(systemId: string): Promise<SystemAttribute[]> {
  const result = await pool.query<SystemAttribute>(
    `SELECT * FROM system_attributes WHERE system_id = $1 ORDER BY display_order`,
    [systemId],
  );
  return result.rows;
}

export async function findAttributeById(
  systemId: string,
  attributeId: string,
): Promise<SystemAttribute | null> {
  const result = await pool.query<SystemAttribute>(
    `SELECT * FROM system_attributes WHERE id = $1 AND system_id = $2`,
    [attributeId, systemId],
  );
  return result.rows[0] ?? null;
}

// RF05 — edição de atributos específicos do sistema
export async function updateAttribute(
  attributeId: string,
  attr: Partial<AttributeInput>,
): Promise<SystemAttribute | null> {
  const result = await pool.query<SystemAttribute>(
    `UPDATE system_attributes SET
       label         = COALESCE($2, label),
       data_type     = COALESCE($3, data_type),
       default_value = COALESCE($4, default_value),
       min_value     = COALESCE($5, min_value),
       max_value     = COALESCE($6, max_value),
       options       = COALESCE($7, options),
       is_required   = COALESCE($8, is_required),
       display_order = COALESCE($9, display_order)
     WHERE id = $1
     RETURNING *`,
    [
      attributeId,
      attr.label,
      attr.data_type,
      attr.default_value,
      attr.min_value,
      attr.max_value,
      attr.options ? JSON.stringify(attr.options) : null,
      attr.is_required,
      attr.display_order,
    ],
  );
  return result.rows[0] ?? null;
}
