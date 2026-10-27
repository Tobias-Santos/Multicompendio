-- Migração incremental — v1.3 (história de origem do personagem).
-- Roda em cima de um banco que já tem a v1.2.1 aplicada. Não altera dados existentes.
--
-- A história fica em uma tabela própria (e não numa coluna de characters) para que o
-- salvamento automático do texto não dispute linha com o salvamento da ficha.
-- Sem linha = personagem sem história (revisão 0).

CREATE TABLE IF NOT EXISTS character_stories (
    character_id    UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    -- documento do editor (JSON): só os elementos que o servidor aceita
    content         JSONB NOT NULL,
    -- sobe 1 a cada gravação; quem grava informa a revisão em que se baseou,
    -- e o banco recusa a gravação se outra aba ou dispositivo gravou antes
    revision        INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_character_stories_updated_at ON character_stories;
CREATE TRIGGER trg_character_stories_updated_at
BEFORE UPDATE ON character_stories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
