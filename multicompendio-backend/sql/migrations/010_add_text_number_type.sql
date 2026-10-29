-- Migração incremental — v1.6 (tipo de campo "texto com número").
-- Roda em cima de um banco que já tem a v1.5 aplicada. Não altera dados; pode rodar de novo sem erro.
--
-- Um campo "texto com número" guarda um número opcional (com mínimo e máximo, como o tipo número) e um
-- texto de várias linhas, no mesmo campo. Serve aos atributos de personagem e aos campos de item.
-- Fica na coluna de valor (JSONB) como {"number": 3, "text": "..."}; só o tipo enumerado precisa mudar.
ALTER TYPE attribute_data_type ADD VALUE IF NOT EXISTS 'text_number';
