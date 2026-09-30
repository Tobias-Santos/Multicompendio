import { pool } from '../db/pool';
import { RpgSystem, UpdateSystemInput } from '../types/system';

// RF01 — cadastro simplificado (só nome + descrição)
export async function insertSystem(
  name: string,
  description: string | undefined,
): Promise<RpgSystem> {
  const result = await pool.query<RpgSystem>(
    `INSERT INTO rpg_systems (name, description)
     VALUES ($1, $2)
     RETURNING *`,
    [name, description ?? null],
  );
  return result.rows[0];
}

export async function findSystemByName(name: string): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(
    `SELECT * FROM rpg_systems WHERE name = $1`,
    [name],
  );
  return result.rows[0] ?? null;
}

export async function findSystemById(id: string): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(
    `SELECT * FROM rpg_systems WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listSystems(): Promise<RpgSystem[]> {
  const result = await pool.query<RpgSystem>(
    `SELECT * FROM rpg_systems ORDER BY name`,
  );
  return result.rows;
}

// Edição das demais propriedades do sistema, feita na página de edição
// (versão, proprietário, descrição). `is_preconfigured` NÃO entra aqui de
// propósito: é um flag de proveniência (sistema que já veio instalado com
// a aplicação, via seed) e não algo que o usuário deveria poder marcar em
// um sistema criado por ele mesmo.
export async function updateSystemById(
  id: string,
  changes: UpdateSystemInput,
): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(
    `UPDATE rpg_systems SET
       description       = COALESCE($2, description),
       owner_user_id     = COALESCE($3, owner_user_id),
       version           = COALESCE($4, version)
     WHERE id = $1
     RETURNING *`,
    [id, changes.description, changes.owner_user_id, changes.version],
  );
  return result.rows[0] ?? null;
}

// RF06 — exclusão de um sistema de RPG
// (a checagem de vínculo com personagens/campanhas — RF38 — entra quando
// esses módulos existirem; por ora exclui direto e deixa o ON DELETE CASCADE
// cuidar dos atributos)
export async function deleteSystemById(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM rpg_systems WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
