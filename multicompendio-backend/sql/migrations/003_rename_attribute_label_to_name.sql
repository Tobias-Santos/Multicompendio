-- Migração incremental — renomeia a coluna "label" para "name" em
-- system_attributes, acompanhando a mudança de terminologia na
-- interface ("Label" → "Nome"). Não apaga dados.

ALTER TABLE system_attributes RENAME COLUMN label TO name;
