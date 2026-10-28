import { pool } from '../db/pool';
import { CreateSystemInput, RpgSystem, UpdateSystemInput } from '../types/system';

// Todo sistema volta com o nome do proprietário (join com users).
const SELECT_SYSTEM = `
  SELECT s.*, u.name AS owner_name
    FROM rpg_systems s
    LEFT JOIN users u ON u.id = s.owner_user_id`;

// RF01 — cadastro: nome, descrição e metadados narrativos
// (idioma, gênero, ambientação, imagem). O proprietário é o usuário
// autenticado — vem da sessão, nunca de um campo digitado.
export async function insertSystem(
  input: CreateSystemInput,
  ownerUserId: string,
): Promise<RpgSystem> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO rpg_systems (name, description, language, genre, setting, image_url, owner_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.name.trim(),
      input.description ?? null,
      input.language ?? null,
      input.genre ?? null,
      input.setting ?? null,
      input.image_url ?? null,
      ownerUserId,
    ],
  );
  return (await findSystemById(inserted.rows[0].id)) as RpgSystem;
}

// Sistemas que o usuário enxerga pelo nome: os pré-configurados e os que ele criou.
export async function findVisibleSystemByName(
  name: string,
  userId: string,
): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(
    `${SELECT_SYSTEM}
      WHERE lower(s.name) = lower($1)
        AND (s.is_preconfigured OR s.owner_user_id = $2)`,
    [name.trim(), userId],
  );
  return result.rows[0] ?? null;
}

export async function findSystemById(id: string): Promise<RpgSystem | null> {
  const result = await pool.query<RpgSystem>(`${SELECT_SYSTEM} WHERE s.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listVisibleSystems(userId: string): Promise<RpgSystem[]> {
  const result = await pool.query<RpgSystem>(
    `${SELECT_SYSTEM}
      WHERE s.is_preconfigured OR s.owner_user_id = $1
         OR EXISTS (SELECT 1 FROM system_members m WHERE m.system_id = s.id AND m.user_id = $1)
      ORDER BY lower(s.name)`,
    [userId],
  );
  return result.rows;
}

// Edição das demais propriedades do sistema, feita na página de edição
// (versão, descrição, idioma, gênero, ambientação, imagem).
//
// Dois campos ficam de fora de propósito, porque não são escolhas do
// usuário sobre o próprio sistema — são atribuídos pelo backend:
//   - is_preconfigured: só é definido pelo seed de instalação (RF04).
//   - owner_user_id: atribuído na criação, a partir do usuário autenticado.
export async function updateSystemById(
  id: string,
  changes: UpdateSystemInput,
): Promise<RpgSystem | null> {
  await pool.query(
    `UPDATE rpg_systems SET
       description       = COALESCE($2, description),
       version           = COALESCE($3, version),
       language          = COALESCE($4, language),
       genre             = COALESCE($5, genre),
       setting           = COALESCE($6, setting),
       image_url         = COALESCE($7, image_url)
     WHERE id = $1`,
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
  return findSystemById(id);
}

// RF06 — exclusão de um sistema de RPG
// (a checagem de vínculo com personagens/campanhas — RF38 — entra quando
// esses módulos existirem; por ora exclui direto e deixa o ON DELETE CASCADE
// cuidar dos atributos)
export async function deleteSystemById(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM rpg_systems WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
