-- Migração incremental — v1.5 (itens e equipamentos).
-- Roda em cima de um banco que já tem a v1.4 aplicada. Não altera dados existentes; pode rodar de novo sem erro.
-- Inclui os campos e os itens prontos do sistema pré-configurado D&D 5e.

SET client_encoding = 'UTF8';  -- o arquivo é UTF-8, qualquer que seja o padrão do psql

-- ------------------------------------------------------------
-- v1.5 — Itens e equipamentos (RF11, RF12)
-- ------------------------------------------------------------
-- Campos que os itens de um sistema têm (ex.: dano, peso). Mesmo formato dos atributos de
-- personagem; definidos pelo dono do sistema e usados como campos do bloco de estatísticas.
CREATE TABLE IF NOT EXISTS system_item_fields (
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

DROP TRIGGER IF EXISTS trg_system_item_fields_updated_at ON system_item_fields;
CREATE TRIGGER trg_system_item_fields_updated_at
BEFORE UPDATE ON system_item_fields
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Itens. owner_user_id nulo = item que já vem com o sistema pré-instalado (só leitura, de todos).
-- Privado por padrão; público só nos sistemas de pessoas (nos pré-instalados, só os que já vêm prontos).
CREATE TABLE IF NOT EXISTS items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id       UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE RESTRICT,
    owner_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT items_preinstalled_public CHECK (owner_user_id IS NOT NULL OR is_public)
);
CREATE INDEX IF NOT EXISTS idx_items_system_owner ON items(system_id, owner_user_id);

DROP TRIGGER IF EXISTS trg_items_updated_at ON items;
CREATE TRIGGER trg_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS item_values (
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    field_id        UUID NOT NULL REFERENCES system_item_fields(id) ON DELETE RESTRICT,
    value           JSONB NOT NULL,
    PRIMARY KEY (item_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_item_values_field ON item_values(field_id);

-- Inventário: quais itens cada personagem carrega e em que quantidade.
-- Um item que está em algum inventário não pode ser excluído (RESTRICT).
CREATE TABLE IF NOT EXISTS character_items (
    character_id    UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 9999),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (character_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_character_items_item ON character_items(item_id);

-- Os dados têm acentos: o arquivo é UTF-8, então a sessão precisa ler como UTF-8 (no Windows o
-- padrão do psql costuma ser WIN1252 e daria erro ou acentos trocados).
SET client_encoding = 'UTF8';

-- ------------------------------------------------------------
-- Itens do sistema pré-configurado Dungeons & Dragons 5e (campos e itens prontos, só leitura)
-- ------------------------------------------------------------
DO $dnd_items$
DECLARE
    sid UUID;
    it  JSONB;
    iid UUID;
    f   RECORD;
BEGIN
    SELECT id INTO sid FROM rpg_systems
     WHERE is_preconfigured AND name ILIKE 'Dungeons & Dragons%' ORDER BY created_at LIMIT 1;
    IF sid IS NULL THEN RETURN; END IF;

    INSERT INTO system_item_fields (system_id, key, name, data_type, options, min_value, max_value, is_required, display_order)
    VALUES
    (sid, 'categoria', 'Categoria', 'select', '["Arma", "Armadura", "Escudo", "Poção", "Equipamento de aventura"]'::jsonb, NULL, NULL, TRUE, 0),
    (sid, 'dano', 'Dano', 'text', NULL, NULL, NULL, FALSE, 1),
    (sid, 'tipo_de_dano', 'Tipo de dano', 'select', '["Contundente", "Cortante", "Perfurante", "Ácido", "Elétrico", "Frio", "Ígneo", "Necrótico", "Radiante", "Trovejante", "Venenoso", "Psíquico", "Energético"]'::jsonb, NULL, NULL, FALSE, 2),
    (sid, 'propriedades', 'Propriedades', 'text', NULL, NULL, NULL, FALSE, 3),
    (sid, 'raridade', 'Raridade', 'select', '["Comum", "Incomum", "Rara", "Muito rara", "Lendária"]'::jsonb, NULL, NULL, FALSE, 4),
    (sid, 'peso_kg', 'Peso (kg)', 'number', NULL, 0, 10000, FALSE, 5),
    (sid, 'preco', 'Preço', 'text', NULL, NULL, NULL, FALSE, 6),
    (sid, 'descricao', 'Descrição', 'longtext', NULL, NULL, NULL, FALSE, 7)
    ON CONFLICT (system_id, key) DO NOTHING;

    -- os itens só entram se o sistema ainda não tem nenhum item pré-instalado
    IF NOT EXISTS (SELECT 1 FROM items WHERE system_id = sid AND owner_user_id IS NULL) THEN
        FOR it IN SELECT * FROM jsonb_array_elements($json$
[
 {
  "name": "Adaga",
  "values": {
   "categoria": "Arma",
   "dano": "1d4",
   "tipo_de_dano": "Perfurante",
   "propriedades": "Acuidade, leve, arremesso (alcance 6/18 m)",
   "raridade": "Comum",
   "peso_kg": 0.5,
   "preco": "2 po",
   "descricao": "Lâmina curta e afiada, a arma de reserva de quase todo aventureiro."
  }
 },
 {
  "name": "Bordão",
  "values": {
   "categoria": "Arma",
   "dano": "1d6",
   "tipo_de_dano": "Contundente",
   "propriedades": "Versátil (1d8)",
   "raridade": "Comum",
   "peso_kg": 2,
   "preco": "2 pp",
   "descricao": "Cajado de madeira reforçada, usado como apoio e como arma."
  }
 },
 {
  "name": "Rapieira",
  "values": {
   "categoria": "Arma",
   "dano": "1d8",
   "tipo_de_dano": "Perfurante",
   "propriedades": "Acuidade",
   "raridade": "Comum",
   "peso_kg": 1,
   "preco": "25 po",
   "descricao": "Espada fina de estocada, favorita de duelistas."
  }
 },
 {
  "name": "Espada longa",
  "values": {
   "categoria": "Arma",
   "dano": "1d8",
   "tipo_de_dano": "Cortante",
   "propriedades": "Versátil (1d10)",
   "raridade": "Comum",
   "peso_kg": 1.5,
   "preco": "15 po",
   "descricao": "Espada de lâmina reta, usada com uma ou duas mãos."
  }
 },
 {
  "name": "Arco curto",
  "values": {
   "categoria": "Arma",
   "dano": "1d6",
   "tipo_de_dano": "Perfurante",
   "propriedades": "Munição (alcance 24/96 m), duas mãos",
   "raridade": "Comum",
   "peso_kg": 1,
   "preco": "25 po"
  }
 },
 {
  "name": "Escudo",
  "values": {
   "categoria": "Escudo",
   "propriedades": "+2 na Classe de Armadura",
   "raridade": "Comum",
   "peso_kg": 3,
   "preco": "10 po"
  }
 },
 {
  "name": "Cota de malha",
  "values": {
   "categoria": "Armadura",
   "propriedades": "CA 16; exige Força 13; desvantagem em Furtividade",
   "raridade": "Comum",
   "peso_kg": 27.5,
   "preco": "75 po"
  }
 },
 {
  "name": "Poção de cura",
  "values": {
   "categoria": "Poção",
   "propriedades": "Recupera 2d4 + 2 pontos de vida ao ser bebida",
   "raridade": "Comum",
   "peso_kg": 0.25,
   "preco": "50 po",
   "descricao": "Um líquido avermelhado que cintila quando agitado."
  }
 },
 {
  "name": "Mochila de explorador",
  "values": {
   "categoria": "Equipamento de aventura",
   "propriedades": "Contém saco de dormir, rações para 10 dias, corda de seda de 15 m, pederneira e tochas",
   "raridade": "Comum",
   "preco": "10 po"
  }
 },
 {
  "name": "Corda de seda (15 m)",
  "values": {
   "categoria": "Equipamento de aventura",
   "propriedades": "Aguenta 150 kg",
   "raridade": "Comum",
   "peso_kg": 2.5,
   "preco": "10 po"
  }
 },
 {
  "name": "Bolsa de componentes",
  "values": {
   "categoria": "Equipamento de aventura",
   "propriedades": "Componentes materiais de magias",
   "raridade": "Comum",
   "peso_kg": 1,
   "preco": "25 po"
  }
 }
]
        $json$::jsonb) LOOP
            INSERT INTO items (system_id, owner_user_id, name, is_public)
            VALUES (sid, NULL, it->>'name', TRUE) RETURNING id INTO iid;
            FOR f IN SELECT id, key FROM system_item_fields WHERE system_id = sid LOOP
                IF (it->'values') ? f.key THEN
                    INSERT INTO item_values (item_id, field_id, value) VALUES (iid, f.id, it->'values'->f.key);
                END IF;
            END LOOP;
        END LOOP;
    END IF;
END
$dnd_items$;
