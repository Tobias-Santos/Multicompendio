import { pool } from '../db/pool';
import { createExampleCharacter } from '../services/exampleCharacterService';

// Dá o personagem de exemplo a quem já tinha conta antes dele existir.
// Seguro para rodar de novo: quem já tem o personagem é pulado.
async function main(): Promise<void> {
  const users = await pool.query<{ id: string; name: string }>(`SELECT id, name FROM users ORDER BY created_at`);
  let created = 0;
  for (const user of users.rows) {
    if (await createExampleCharacter(user.id)) {
      created++;
      console.log(`  + ${user.name}`);
    }
  }
  console.log(`${created} personagem(ns) de exemplo criado(s); ${users.rows.length - created} já tinham ou foram pulados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
