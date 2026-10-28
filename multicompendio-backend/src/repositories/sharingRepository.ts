import { pool } from '../db/pool';

export interface MemberRow {
  user_id: string;
  name: string;
  joined_at: string;
  characters: number; // quantos personagens a pessoa tem neste sistema
}

export async function isMember(systemId: string, userId: string): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM system_members WHERE system_id = $1 AND user_id = $2`, [
    systemId,
    userId,
  ]);
  return result.rows.length > 0;
}

// Ids dos sistemas em que a pessoa entrou por convite.
export async function listMembershipSystemIds(userId: string): Promise<Set<string>> {
  const result = await pool.query<{ system_id: string }>(`SELECT system_id FROM system_members WHERE user_id = $1`, [
    userId,
  ]);
  return new Set(result.rows.map((r) => r.system_id));
}

export async function addMember(systemId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO system_members (system_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [systemId, userId],
  );
}

export async function removeMember(systemId: string, userId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM system_members WHERE system_id = $1 AND user_id = $2`, [systemId, userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listMembers(systemId: string): Promise<MemberRow[]> {
  const result = await pool.query<MemberRow & { characters: string }>(
    `SELECT m.user_id, u.name, m.joined_at,
            (SELECT count(*) FROM characters c WHERE c.system_id = m.system_id AND c.owner_user_id = m.user_id) AS characters
       FROM system_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.system_id = $1
      ORDER BY m.joined_at`,
    [systemId],
  );
  return result.rows.map((r) => ({ ...r, characters: Number(r.characters) }));
}

export async function countCharactersOf(systemId: string, userId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT count(*) AS total FROM characters WHERE system_id = $1 AND owner_user_id = $2`,
    [systemId, userId],
  );
  return Number(result.rows[0].total);
}

export async function getInviteToken(systemId: string): Promise<string | null> {
  const result = await pool.query<{ token: string }>(`SELECT token FROM system_invites WHERE system_id = $1`, [systemId]);
  return result.rows[0]?.token ?? null;
}

// Cria o convite ou troca o código do que já existe (o link anterior deixa de valer).
export async function saveInviteToken(systemId: string, token: string): Promise<void> {
  await pool.query(
    `INSERT INTO system_invites (system_id, token) VALUES ($1, $2)
     ON CONFLICT (system_id) DO UPDATE SET token = EXCLUDED.token, created_at = now()`,
    [systemId, token],
  );
}

export async function deleteInvite(systemId: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM system_invites WHERE system_id = $1`, [systemId]);
  return (result.rowCount ?? 0) > 0;
}

export async function findSystemIdByToken(token: string): Promise<string | null> {
  const result = await pool.query<{ system_id: string }>(`SELECT system_id FROM system_invites WHERE token = $1`, [token]);
  return result.rows[0]?.system_id ?? null;
}
