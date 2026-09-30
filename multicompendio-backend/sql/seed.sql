-- ============================================================
-- Multicompêndio — Seed: RF04
-- "A aplicação deve fornecer pelo menos um sistema de RPG
-- pré-configurado após a instalação."
--
-- Roda UMA VEZ, na instalação (depois de schema.sql), fora do
-- fluxo normal da API. Por isso vai direto via INSERT — é o único
-- lugar em que faz sentido gravar is_preconfigured = true, já que
-- nenhum usuário está "criando" este sistema.
-- ============================================================

DO $$
DECLARE
    v_system_id UUID;
BEGIN
    -- Evita duplicar o seed se rodar mais de uma vez
    IF EXISTS (SELECT 1 FROM rpg_systems WHERE name = 'Dungeons & Dragons 5e (exemplo)') THEN
        RAISE NOTICE 'Seed já aplicado, pulando.';
        RETURN;
    END IF;

    INSERT INTO rpg_systems (name, description, version, is_preconfigured)
    VALUES (
        'Dungeons & Dragons 5e (exemplo)',
        'Sistema de exemplo pré-configurado, disponível desde a instalação.',
        '5e',
        TRUE
    )
    RETURNING id INTO v_system_id;

    INSERT INTO system_attributes (system_id, key, label, data_type, min_value, max_value, is_required, display_order)
    VALUES
        (v_system_id, 'forca',       'Força',        'number', 1, 20, TRUE, 0),
        (v_system_id, 'destreza',    'Destreza',     'number', 1, 20, TRUE, 1),
        (v_system_id, 'constituicao','Constituição', 'number', 1, 20, TRUE, 2),
        (v_system_id, 'inteligencia','Inteligência', 'number', 1, 20, TRUE, 3),
        (v_system_id, 'sabedoria',   'Sabedoria',    'number', 1, 20, TRUE, 4),
        (v_system_id, 'carisma',     'Carisma',      'number', 1, 20, TRUE, 5);
END $$;
