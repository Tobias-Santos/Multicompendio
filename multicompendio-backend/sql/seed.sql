-- ============================================================
-- Multicompêndio — Seed: sistema pré-configurado disponível
-- desde a instalação (não criado pelo usuário).
--
-- Roda UMA VEZ, na instalação (depois de schema.sql), fora do
-- fluxo normal da API — por isso insere direto via SQL.
--
-- Força client_encoding para UTF8 nesta sessão, independente da
-- code page do terminal, evitando acentos corrompidos ao gravar.
-- ============================================================

SET client_encoding = 'UTF8';

DO $$
DECLARE
    v_system_id UUID;
BEGIN
    -- Evita duplicar o seed se rodar mais de uma vez
    IF EXISTS (SELECT 1 FROM rpg_systems WHERE name = 'Dungeons & Dragons 5e') THEN
        RAISE NOTICE 'Seed já aplicado, pulando.';
        RETURN;
    END IF;

    INSERT INTO rpg_systems (name, description, version, is_preconfigured)
    VALUES (
        'Dungeons & Dragons 5e',
        'Sistema clássico de fantasia medieval, disponível desde a instalação.',
        '5e',
        TRUE
    )
    RETURNING id INTO v_system_id;

    INSERT INTO system_attributes (system_id, key, name, data_type, min_value, max_value, is_required, display_order)
    VALUES
        (v_system_id, 'forca',        'Força',        'number', 1, 20, TRUE, 0),
        (v_system_id, 'destreza',     'Destreza',     'number', 1, 20, TRUE, 1),
        (v_system_id, 'constituicao', 'Constituição', 'number', 1, 20, TRUE, 2),
        (v_system_id, 'inteligencia', 'Inteligência', 'number', 1, 20, TRUE, 3),
        (v_system_id, 'sabedoria',    'Sabedoria',    'number', 1, 20, TRUE, 4),
        (v_system_id, 'carisma',      'Carisma',      'number', 1, 20, TRUE, 5);
END $$;
