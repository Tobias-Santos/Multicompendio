-- ============================================================
-- ATENÇÃO — script destrutivo, de uso manual.
--
-- Apaga o(s) sistema(s) pré-configurado(s) E TODOS OS PERSONAGENS E ITENS
-- criados neles, e em seguida recria o sistema a partir de seed.sql.
-- Use quando a definição do sistema pré-configurado mudar (ex.: nova
-- ficha do D&D). Sistemas, personagens e itens dos usuários nos outros
-- sistemas não são tocados.
--
-- Como rodar (a partir da pasta multicompendio-backend):
--   psql -U postgres -d multicompendio -f sql/reset_preconfigured_system.sql
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

-- Personagens primeiro: o banco recusa excluir um sistema que ainda tem personagens (RF04).
DELETE FROM characters
 WHERE system_id IN (SELECT id FROM rpg_systems WHERE is_preconfigured);

-- Itens também: o banco recusa excluir um sistema que ainda tem itens, e um item que está num inventário.
-- (o inventário dos personagens já saiu junto com eles; a linha abaixo é só uma garantia)
DELETE FROM character_items
 WHERE item_id IN (SELECT id FROM items WHERE system_id IN (SELECT id FROM rpg_systems WHERE is_preconfigured));
DELETE FROM items
 WHERE system_id IN (SELECT id FROM rpg_systems WHERE is_preconfigured);

-- Os atributos, os campos de item e o layout do sistema saem junto (ON DELETE CASCADE).
DELETE FROM rpg_systems WHERE is_preconfigured;

COMMIT;

-- \ir inclui o arquivo relativo a ESTE script, então funciona de qualquer pasta.
\ir seed.sql
