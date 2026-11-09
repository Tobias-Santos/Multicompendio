-- Migracao incremental - v1.8 (layout da ficha).
-- Roda em cima de um banco que ja tem a v1.7 aplicada. Nao altera dados existentes; pode rodar de novo sem erro.
--
-- O layout da ficha de um sistema (paginas, secoes, posicao, tamanho e formato de cada campo, em milimetros)
-- fica num documento JSON por sistema. Sistemas sem layout salvo usam o layout automatico, calculado na hora.
-- Os campos que nao estao no layout ficam "na gaveta": sao os atributos que sobram, nao ha tabela para eles.

SET client_encoding = 'UTF8';  -- o arquivo e UTF-8, qualquer que seja o padrao do psql

CREATE TABLE IF NOT EXISTS system_layouts (
    system_id   UUID PRIMARY KEY REFERENCES rpg_systems(id) ON DELETE CASCADE,
    layout      JSONB NOT NULL,
    -- sobe a cada gravacao; quem grava informa a versao em que se baseou (evita uma aba apagar o trabalho de outra)
    version     INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
