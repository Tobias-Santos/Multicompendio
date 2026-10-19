-- Migração incremental — v1.2.1 (ficha completa do D&D 5e).
-- Roda em cima de um banco que já tem a v1.2 aplicada. Não altera dados existentes.
--
-- 1) Seções: agrupam atributos parecidos na ficha (ex.: "Combate", "Perícias").
-- 2) Texto longo: novo tipo de atributo, para campos de várias linhas.

ALTER TABLE system_attributes ADD COLUMN IF NOT EXISTS group_name VARCHAR(80);

-- Observação: ADD VALUE não pode ser usado dentro de um bloco de transação em
-- bancos antigos; rode este arquivo normalmente (psql -f), sem --single-transaction.
ALTER TYPE attribute_data_type ADD VALUE IF NOT EXISTS 'longtext';
