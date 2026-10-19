-- ============================================================
-- ATENÇÃO — script destrutivo, de uso manual.
--
-- Apaga o(s) sistema(s) pré-configurado(s) E TODOS OS PERSONAGENS
-- criados neles, e em seguida recria o sistema a partir de seed.sql.
-- Use quando a definição do sistema pré-configurado mudar (ex.: nova
-- ficha do D&D). Sistemas e personagens dos usuários não são tocados.
--
-- Como rodar (a partir da pasta multicompendio-backend):
--   psql -U postgres -d multicompendio -f sql/reset_preconfigured_system.sql
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

-- Personagens primeiro: o banco recusa excluir um sistema que ainda tem personagens (RF38).
DELETE FROM characters
 WHERE system_id IN (SELECT id FROM rpg_systems WHERE is_preconfigured);

-- Os atributos do sistema saem junto (ON DELETE CASCADE).
DELETE FROM rpg_systems WHERE is_preconfigured;

COMMIT;

-- \ir inclui o arquivo relativo a ESTE script, então funciona de qualquer pasta.
\ir seed.sql
