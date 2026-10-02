import { pool } from '../db/pool';
import { CreateSystemInput, RpgSystem, UpdateSystemInput } from '../types/system';

// RF01 — cadastro: nome, descrição e metadados narrativos
// (idioma, gênero, ambientação, imagem)
export async function insertSystem(input: CreateSystemInput): Promise<RpgSystem> {
  const result = await pool.query<RpgSystem>(
    `INSERT INTO rpg_systems (name, description, language, genre, setting, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.language ?? null,
      input.genre ?? null,
      input.setting ?? null,
      input.image_url ?? null,
    ],
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
// (versão, descrição, idioma, gênero, ambientação, imagem).
//
// Dois campos ficam de fora de propósito, porque não são escolhas do
// usuário sobre o próprio sistema — são atribuídos pelo backend:
//   - is_preconfigured: só é definido pelo seed de instalação (RF04).
//   - owner_user_id: quando a autenticação existir, deve ser atribuído
//     automaticamente a partir do usuário autenticado no momento da
//     criação (req.user.id), nunca digitado manualmente. Por enquanto
//     fica null em todo sistema, já que ainda não há login.
export async function updateSystemById(
  id: string,
  changes: UpdateSystemInput,
): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(
    `UPDATE rpg_systems SET
       description       = COALESCE($2, description),
       version           = COALESCE($3, version),
       language          = COALESCE($4, language),
       genre             = COALESCE($5, genre),
       setting           = COALESCE($6, setting),
       image_url         = COALESCE($7, image_url)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      changes.description,
      changes.version,
      changes.language,
      changes.genre,
      changes.setting,
      changes.image_url,
    ],
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
