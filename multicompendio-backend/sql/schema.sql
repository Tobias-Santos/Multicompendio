-- ============================================================
-- Multicompêndio — Schema: Módulo de Sistemas de RPG (v1.0)
-- Cobre: RF01, RF02, RF03, RF05, RF06
-- ============================================================

-- Tipo de dado que um atributo de sistema pode assumir.
-- 'select' usa a coluna `options` (JSONB) para armazenar as escolhas possíveis.
CREATE TYPE attribute_data_type AS ENUM ('number', 'text', 'boolean', 'select');

-- ------------------------------------------------------------
-- Tabela mínima de usuários — placeholder até o módulo de
-- autenticação (RF37) existir de fato. Serve só para dar suporte
-- à FK de "usuário proprietário" em rpg_systems.
-- ------------------------------------------------------------
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(60) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT users_username_unique UNIQUE (username)
);

-- ------------------------------------------------------------
-- RF01 — Cadastro de um sistema de RPG
-- RF06 — Exclusão de um sistema de RPG
-- ------------------------------------------------------------
CREATE TABLE rpg_systems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL, -- nullable até RF37 existir
    version         VARCHAR(50),                                  -- ex: "5e", "1.0", "Revisado 2024"
    language        VARCHAR(60),                                  -- ex: "Português", "Inglês"
    genre           VARCHAR(60),                                  -- ex: "Fantasia", "Terror", "Ficção científica"
    setting         TEXT,                                         -- ambientação/cenário do sistema
    image_url       TEXT,                                         -- URL de uma imagem de capa
    is_preconfigured BOOLEAN NOT NULL DEFAULT FALSE, -- suporte futuro ao RF04
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rpg_systems_name_unique UNIQUE (name)
);

CREATE INDEX idx_rpg_systems_owner_user_id ON rpg_systems(owner_user_id);

-- ------------------------------------------------------------
-- RF02 — Configuração de atributos específicos de cada sistema
-- RF05 — Edição de atributos específicos do sistema
-- ------------------------------------------------------------
CREATE TABLE system_attributes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE CASCADE,

    key             VARCHAR(60) NOT NULL,   -- identificador técnico interno, gerado pela aplicação a partir do nome
    name            VARCHAR(120) NOT NULL,  -- nome exibido ao usuário, ex: "Força"
    data_type       attribute_data_type NOT NULL,

    default_value   TEXT,                   -- guardado como texto, convertido pela app conforme data_type
    min_value       NUMERIC,                -- usado só quando data_type = 'number'
    max_value       NUMERIC,
    options         JSONB,                  -- usado só quando data_type = 'select', ex: ["Leve","Médio","Pesado"]

    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INTEGER NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT system_attributes_key_unique UNIQUE (system_id, key),
    CONSTRAINT system_attributes_minmax_check
        CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE INDEX idx_system_attributes_system_id ON system_attributes(system_id);

-- ------------------------------------------------------------
-- RF03 — Consistência mínima do sistema antes do cadastro
-- ------------------------------------------------------------
-- A regra "todo sistema precisa de pelo menos 1 atributo configurado"
-- não é expressável como constraint simples de linha (depende de uma
-- tabela filha), então fica a cargo da camada de serviço/domínio:
-- só liberar o cadastro definitivo do sistema após ele ter >= 1
-- registro em system_attributes. Duas formas comuns de implementar:
--
--   (a) Fluxo em 2 passos: cria o sistema como "rascunho", só marca
--       como "ativo" quando tiver atributos válidos.
--   (b) Transação única: INSERT em rpg_systems + INSERT em
--       system_attributes na mesma transação, com rollback se
--       a validação de negócio falhar.
--
-- Se quiser reforçar isso no banco, dá pra adicionar uma coluna
-- de status em rpg_systems e um trigger que impede UPDATE para
-- 'active' sem atributos associados. Ex.:
--
-- ALTER TABLE rpg_systems ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'draft';
--
-- CREATE OR REPLACE FUNCTION check_system_has_attributes()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF NEW.status = 'active' AND NOT EXISTS (
--         SELECT 1 FROM system_attributes WHERE system_id = NEW.id
--     ) THEN
--         RAISE EXCEPTION 'Sistema % não pode ser ativado sem atributos configurados', NEW.id;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_check_system_has_attributes
-- BEFORE UPDATE ON rpg_systems
-- FOR EACH ROW
-- WHEN (NEW.status IS DISTINCT FROM OLD.status)
-- EXECUTE FUNCTION check_system_has_attributes();

-- ------------------------------------------------------------
-- Trigger genérico para manter updated_at em dia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rpg_systems_updated_at
BEFORE UPDATE ON rpg_systems
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_system_attributes_updated_at
BEFORE UPDATE ON system_attributes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
