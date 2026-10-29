#!/usr/bin/env python3
"""Gera o SQL dos itens (v1.5): a migração 009, o trecho do schema.sql e o do seed.sql.
Uma única fonte de dados (abaixo) alimenta os três, então nunca saem diferentes.
Uso, na pasta multicompendio-backend:  python3 tools/gen_dnd_items.py
É seguro rodar de novo: os trechos já inseridos são substituídos, não duplicados."""
import json, re, pathlib

SQL = pathlib.Path(__file__).resolve().parent.parent / 'sql'

# ------------------------------------------------------------------ DDL
DDL = """\
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
"""

# ------------------------------------------------------------------ dados do D&D 5e
DANOS = ['Contundente', 'Cortante', 'Perfurante', 'Ácido', 'Elétrico', 'Frio', 'Ígneo', 'Necrótico', 'Radiante', 'Trovejante', 'Venenoso', 'Psíquico', 'Energético']
FIELDS = [  # chave, nome, tipo, opções, mínimo, máximo, obrigatório
    ('categoria', 'Categoria', 'select', ['Arma', 'Armadura', 'Escudo', 'Poção', 'Equipamento de aventura'], None, None, True),
    ('dano', 'Dano', 'text', None, None, None, False),
    ('tipo_de_dano', 'Tipo de dano', 'select', DANOS, None, None, False),
    ('propriedades', 'Propriedades', 'text', None, None, None, False),
    ('raridade', 'Raridade', 'select', ['Comum', 'Incomum', 'Rara', 'Muito rara', 'Lendária'], None, None, False),
    ('peso_kg', 'Peso (kg)', 'number', None, 0, 10000, False),
    ('preco', 'Preço', 'text', None, None, None, False),
    ('descricao', 'Descrição', 'longtext', None, None, None, False),
]
ITEMS = [
    ('Adaga', dict(categoria='Arma', dano='1d4', tipo_de_dano='Perfurante', propriedades='Acuidade, leve, arremesso (alcance 6/18 m)', raridade='Comum', peso_kg=0.5, preco='2 po', descricao='Lâmina curta e afiada, a arma de reserva de quase todo aventureiro.')),
    ('Bordão', dict(categoria='Arma', dano='1d6', tipo_de_dano='Contundente', propriedades='Versátil (1d8)', raridade='Comum', peso_kg=2, preco='2 pp', descricao='Cajado de madeira reforçada, usado como apoio e como arma.')),
    ('Rapieira', dict(categoria='Arma', dano='1d8', tipo_de_dano='Perfurante', propriedades='Acuidade', raridade='Comum', peso_kg=1, preco='25 po', descricao='Espada fina de estocada, favorita de duelistas.')),
    ('Espada longa', dict(categoria='Arma', dano='1d8', tipo_de_dano='Cortante', propriedades='Versátil (1d10)', raridade='Comum', peso_kg=1.5, preco='15 po', descricao='Espada de lâmina reta, usada com uma ou duas mãos.')),
    ('Arco curto', dict(categoria='Arma', dano='1d6', tipo_de_dano='Perfurante', propriedades='Munição (alcance 24/96 m), duas mãos', raridade='Comum', peso_kg=1, preco='25 po')),
    ('Escudo', dict(categoria='Escudo', propriedades='+2 na Classe de Armadura', raridade='Comum', peso_kg=3, preco='10 po')),
    ('Cota de malha', dict(categoria='Armadura', propriedades='CA 16; exige Força 13; desvantagem em Furtividade', raridade='Comum', peso_kg=27.5, preco='75 po')),
    ('Poção de cura', dict(categoria='Poção', propriedades='Recupera 2d4 + 2 pontos de vida ao ser bebida', raridade='Comum', peso_kg=0.25, preco='50 po', descricao='Um líquido avermelhado que cintila quando agitado.')),
    ('Mochila de explorador', dict(categoria='Equipamento de aventura', propriedades='Contém saco de dormir, rações para 10 dias, corda de seda de 15 m, pederneira e tochas', raridade='Comum', preco='10 po')),
    ('Corda de seda (15 m)', dict(categoria='Equipamento de aventura', propriedades='Aguenta 150 kg', raridade='Comum', peso_kg=2.5, preco='10 po')),
    ('Bolsa de componentes', dict(categoria='Equipamento de aventura', propriedades='Componentes materiais de magias', raridade='Comum', peso_kg=1, preco='25 po')),
]

def esc(s): return s.replace("'", "''")
def fields_sql():
    rows = []
    for i, (key, name, typ, opts, mn, mx, req) in enumerate(FIELDS):
        rows.append("    (sid, '%s', '%s', '%s', %s, %s, %s, %s, %d)" % (
            key, esc(name), typ,
            ("'%s'::jsonb" % esc(json.dumps(opts, ensure_ascii=False))) if opts else 'NULL',
            mn if mn is not None else 'NULL', mx if mx is not None else 'NULL', 'TRUE' if req else 'FALSE', i))
    return ",\n".join(rows)

DATA = f"""\
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
{fields_sql()}
    ON CONFLICT (system_id, key) DO NOTHING;

    -- os itens só entram se o sistema ainda não tem nenhum item pré-instalado
    IF NOT EXISTS (SELECT 1 FROM items WHERE system_id = sid AND owner_user_id IS NULL) THEN
        FOR it IN SELECT * FROM jsonb_array_elements($json$
{json.dumps([{'name': n, 'values': v} for n, v in ITEMS], ensure_ascii=False, indent=1)}
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
"""

def splice(path, marker, block):
    """coloca `block` entre marcadores no arquivo; se já houver, substitui."""
    text = path.read_text(encoding='utf-8')
    begin, end = f'-- >>> {marker}', f'-- <<< {marker}'
    wrapped = f'{begin}\n{block}{end}\n'
    if begin in text:
        text = re.sub(re.escape(begin) + r'.*?' + re.escape(end) + r'\n', lambda m: wrapped, text, flags=re.S)
    else:
        text = text.rstrip('\n') + '\n\n' + wrapped
    path.write_text(text, encoding='utf-8')

# schema.sql: as tabelas, sem os "IF NOT EXISTS" e DROP (instalação nova)
schema_block = DDL.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE').replace('CREATE INDEX IF NOT EXISTS', 'CREATE INDEX')
schema_block = re.sub(r'DROP TRIGGER IF EXISTS [^\n]*\n', '', schema_block)
splice(SQL / 'schema.sql', 'ITENS (v1.5)', schema_block)
splice(SQL / 'seed.sql', 'ITENS DO D&D', DATA)
(SQL / 'migrations' / '009_add_items.sql').write_text(
    "-- Migração incremental — v1.5 (itens e equipamentos).\n"
    "-- Roda em cima de um banco que já tem a v1.4 aplicada. Não altera dados existentes; pode rodar de novo sem erro.\n"
    "-- Inclui os campos e os itens prontos do sistema pré-configurado D&D 5e.\n\n"
    "SET client_encoding = 'UTF8';  -- o arquivo é UTF-8, qualquer que seja o padrão do psql\n\n" + DDL + "\n" + DATA, encoding='utf-8')
print('gerado: migrations/009_add_items.sql, trecho do schema.sql e do seed.sql;', len(FIELDS), 'campos e', len(ITEMS), 'itens')
