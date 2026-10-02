-- Migração incremental — roda em cima de um banco que já tem o schema
-- anterior aplicado. Não apaga nada existente.

ALTER TABLE rpg_systems
    ADD COLUMN IF NOT EXISTS language   VARCHAR(60),
    ADD COLUMN IF NOT EXISTS genre      VARCHAR(60),
    ADD COLUMN IF NOT EXISTS setting    TEXT,
    ADD COLUMN IF NOT EXISTS image_url  TEXT;
