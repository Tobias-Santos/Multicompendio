-- Atributos calculados (RF14): o valor não é digitado, é calculado a partir de outros atributos.
-- Migração aditiva: um valor novo no tipo e uma coluna nula. Idempotente.
-- Observação: ADD VALUE não pode ser usado dentro de um bloco de transação em versões antigas
-- do PostgreSQL; rode este arquivo fora de BEGIN/COMMIT (como a 006 e a 010).
ALTER TYPE attribute_data_type ADD VALUE IF NOT EXISTS 'calculated';

-- A conta: { start, steps } (veja src/calcCore). Só os atributos de personagem usam; os campos dos
-- itens não têm atributos calculados.
ALTER TABLE system_attributes ADD COLUMN IF NOT EXISTS calc JSONB;
