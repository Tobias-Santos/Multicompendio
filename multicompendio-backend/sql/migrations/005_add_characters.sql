-- Migração incremental — v1.2 (personagens, RF09 a RF16, e trava do RF38).
-- Roda em cima de um banco que já tem a v1.1 aplicada. Não altera dados existentes.

-- ------------------------------------------------------------
-- v1.2 — Personagens (RF09 a RF16) e trava de exclusão (RF38)
-- ------------------------------------------------------------
-- Um personagem pertence a um sistema e a um usuário.
-- ON DELETE RESTRICT em system_id: o banco recusa excluir um sistema
-- que ainda tem personagens (RF38) — a aplicação checa antes e mostra
-- uma mensagem clara, e esta regra fica como segunda barreira.
CREATE TABLE characters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE RESTRICT,
    owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_characters_owner_system ON characters(owner_user_id, system_id);

-- Valor de cada atributo do sistema para um personagem. Uma linha por
-- (personagem, atributo), com o valor em JSONB (número, texto ou verdadeiro/falso).
-- Ter uma linha por atributo (e não um JSON único no personagem) deixa o
-- banco pronto para atributos calculados no futuro e permite que ele
-- recuse excluir um atributo que ainda está em uso (ON DELETE RESTRICT).
CREATE TABLE character_values (
    character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    attribute_id    UUID NOT NULL REFERENCES system_attributes(id) ON DELETE RESTRICT,
    value           JSONB NOT NULL,

    PRIMARY KEY (character_id, attribute_id)
);

CREATE INDEX idx_character_values_attribute ON character_values(attribute_id);

CREATE TRIGGER trg_characters_updated_at
BEFORE UPDATE ON characters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
