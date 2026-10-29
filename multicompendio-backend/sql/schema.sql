-- ============================================================
-- Multicompêndio — Schema: Módulo de Sistemas de RPG (v1.0)
-- Cobre: RF01, RF02, RF03, RF05, RF06
-- ============================================================

-- Tipo de dado que um atributo de sistema pode assumir.
-- 'select' usa a coluna `options` (JSONB) para armazenar as escolhas possíveis.
CREATE TYPE attribute_data_type AS ENUM ('number', 'text', 'longtext', 'boolean', 'select', 'text_number');

-- ------------------------------------------------------------
-- RF37 — Usuários (cadastro e entrada na aplicação)
-- `name` é o nome de exibição (pode repetir entre pessoas);
-- o e-mail é o identificador de acesso e é único.
-- A senha nunca é guardada em texto: só o hash (scrypt).
-- ------------------------------------------------------------
CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(60) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- ------------------------------------------------------------
-- RF01 — Cadastro de um sistema de RPG
-- RF06 — Exclusão de um sistema de RPG
-- ------------------------------------------------------------
CREATE TABLE rpg_systems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL, -- null nos sistemas pré-configurados (RF04)
    version         VARCHAR(50),                                  -- ex: "5e", "1.0", "Revisado 2024"
    language        VARCHAR(60),                                  -- ex: "Português", "Inglês"
    genre           VARCHAR(60),                                  -- ex: "Fantasia", "Terror", "Ficção científica"
    setting         TEXT,                                         -- ambientação/cenário do sistema
    image_url       TEXT,                                         -- URL de uma imagem de capa
    is_preconfigured BOOLEAN NOT NULL DEFAULT FALSE, -- suporte futuro ao RF04
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O nome do sistema é único por proprietário (duas pessoas podem ter
-- um sistema com o mesmo nome).
CREATE UNIQUE INDEX rpg_systems_owner_name_unique ON rpg_systems (owner_user_id, lower(name));

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
    group_name      VARCHAR(80),            -- seção da ficha em que aparece, ex: "Combate" (opcional)
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
    -- visível, só para leitura, às outras pessoas do mesmo sistema; privado por padrão
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
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

-- ------------------------------------------------------------
-- v1.3 — História de origem do personagem (RF08)
-- ------------------------------------------------------------
-- A história fica em uma tabela própria (e não numa coluna de characters) para que o
-- salvamento automático do texto não dispute linha com o salvamento da ficha.
-- Sem linha = personagem sem história (revisão 0).
CREATE TABLE character_stories (
    character_id    UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    -- documento do editor (JSON): só os elementos que o servidor aceita
    content         JSONB NOT NULL,
    -- sobe 1 a cada gravação; quem grava informa a revisão em que se baseou,
    -- e o banco recusa a gravação se outra aba ou dispositivo gravou antes
    revision        INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_character_stories_updated_at
BEFORE UPDATE ON character_stories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- v1.4 — Compartilhamento de sistemas
-- ------------------------------------------------------------
-- Quem entrou em um sistema de outra pessoa pelo link de convite.
-- (O dono do sistema não aparece aqui: ele já é o dono.)
CREATE TABLE system_members (
    system_id   UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (system_id, user_id)
);
CREATE INDEX idx_system_members_user ON system_members(user_id);

-- Link de convite do sistema: no máximo um ativo por sistema.
-- Gerar um novo link troca o código e invalida o anterior; apagar a linha desativa o convite.
CREATE TABLE system_invites (
    system_id   UUID PRIMARY KEY REFERENCES rpg_systems(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- >>> ITENS (v1.5)
-- ------------------------------------------------------------
-- v1.5 — Itens e equipamentos (RF11, RF12)
-- ------------------------------------------------------------
-- Campos que os itens de um sistema têm (ex.: dano, peso). Mesmo formato dos atributos de
-- personagem; definidos pelo dono do sistema e usados como campos do bloco de estatísticas.
CREATE TABLE system_item_fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE CASCADE,
    key             VARCHAR(60) NOT NULL,
    name            VARCHAR(120) NOT NULL,
    group_name      VARCHAR(80),
    data_type       attribute_data_type NOT NULL,
    default_value   TEXT,
    min_value       NUMERIC,
    max_value       NUMERIC,
    options         JSONB,
    is_required     BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT system_item_fields_key_unique UNIQUE (system_id, key),
    CONSTRAINT system_item_fields_minmax_check
        CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE TRIGGER trg_system_item_fields_updated_at
BEFORE UPDATE ON system_item_fields
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itens. owner_user_id nulo = item que já vem com o sistema pré-instalado (só leitura, de todos).
-- Privado por padrão; público só nos sistemas de pessoas (nos pré-instalados, só os que já vêm prontos).
CREATE TABLE items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE RESTRICT,
    owner_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT items_preinstalled_public CHECK (owner_user_id IS NOT NULL OR is_public)
);
CREATE INDEX idx_items_system_owner ON items(system_id, owner_user_id);

CREATE TRIGGER trg_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE item_values (
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES system_item_fields(id) ON DELETE RESTRICT,
    value           JSONB NOT NULL,
    PRIMARY KEY (item_id, field_id)
);
CREATE INDEX idx_item_values_field ON item_values(field_id);

-- Inventário: quais itens cada personagem carrega e em que quantidade.
-- Um item que está em algum inventário não pode ser excluído (RESTRICT).
CREATE TABLE character_items (
    character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 9999),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (character_id, item_id)
);
CREATE INDEX idx_character_items_item ON character_items(item_id);
-- <<< ITENS (v1.5)
