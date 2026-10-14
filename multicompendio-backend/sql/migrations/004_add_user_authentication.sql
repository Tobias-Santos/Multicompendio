-- Migração incremental — v1.1 (RF37: cadastro e entrada de usuários).
-- Roda em cima de um banco que já tem o schema da v1.0 aplicado.
-- Não apaga dados de sistemas.

-- 1) Usuários: nome de exibição, e-mail e senha (somente o hash)
ALTER TABLE users RENAME COLUMN username TO name;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

-- 2) O nome do sistema passa a ser único por proprietário, e não mais
--    no banco inteiro (duas pessoas podem ter um sistema com o mesmo nome)
ALTER TABLE rpg_systems DROP CONSTRAINT IF EXISTS rpg_systems_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS rpg_systems_owner_name_unique
    ON rpg_systems (owner_user_id, lower(name));

-- Observação: sistemas criados antes desta versão ficam sem proprietário
-- e, por isso, deixam de aparecer para os usuários. Depois de criar a sua
-- conta, você pode assumir a posse deles com:
--
-- UPDATE rpg_systems
--    SET owner_user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
--  WHERE owner_user_id IS NULL AND is_preconfigured = FALSE;
