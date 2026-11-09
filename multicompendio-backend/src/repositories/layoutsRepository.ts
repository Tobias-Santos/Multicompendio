import { pool } from '../db/pool';

export interface StoredLayout {
  system_id: string;
  layout: unknown;
  version: number;
  updated_by: string | null;
  updated_at: string;
}

export async function findLayout(systemId: string): Promise<StoredLayout | null> {
  const result = await pool.query<StoredLayout>('SELECT * FROM system_layouts WHERE system_id = $1', [systemId]);
  return result.rows[0] ?? null;
}

// Grava só se a versão em que quem grava se baseou ainda é a atual (0 = ainda não há layout salvo).
// Devolve a nova versão, ou nulo se outra gravação chegou antes.
export async function saveLayout(systemId: string, userId: string, layout: unknown, expectedVersion: number): Promise<number | null> {
  const json = JSON.stringify(layout);
  if (expectedVersion === 0) {
    const r = await pool.query<{ version: number }>(
      `INSERT INTO system_layouts (system_id, layout, version, updated_by)
       VALUES ($1, $2::jsonb, 1, $3)
       ON CONFLICT (system_id) DO NOTHING
       RETURNING version`,
      [systemId, json, userId],
    );
    return r.rows[0]?.version ?? null;
  }
  const r = await pool.query<{ version: number }>(
    `UPDATE system_layouts
        SET layout = $2::jsonb, version = version + 1, updated_by = $3, updated_at = now()
      WHERE system_id = $1 AND version = $4
      RETURNING version`,
    [systemId, json, userId, expectedVersion],
  );
  return r.rows[0]?.version ?? null;
}

export async function deleteLayout(systemId: string): Promise<void> {
  await pool.query('DELETE FROM system_layouts WHERE system_id = $1', [systemId]);
}
