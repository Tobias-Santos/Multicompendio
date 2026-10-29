-- ============================================================
-- Multicompêndio — Seed: sistema pré-configurado disponível
-- desde a instalação (não criado por nenhum usuário).
--
-- Dungeons & Dragons 5ª edição, modelado a partir da ficha oficial
-- em português (3 páginas): 144 atributos em 12 seções.
-- A correspondência de cada atributo com o campo do PDF está em
-- sql/ficha-dnd5e-campos.md.
--
-- Roda UMA VEZ, na instalação (depois de schema.sql), fora do fluxo
-- normal da API — por isso insere direto via SQL. É seguro rodar de
-- novo: se o sistema já existe, não faz nada. Para RECRIAR o sistema do
-- zero, use sql/reset_preconfigured_system.sql.
--
-- Os modificadores, salvaguardas e perícias são campos comuns, preenchidos
-- à mão (ainda não há atributos calculados).
--
-- Força client_encoding para UTF8 nesta sessão, independente da
-- code page do terminal, evitando acentos corrompidos ao gravar.
-- ============================================================

SET client_encoding = 'UTF8';

DO $$
DECLARE
    v_system_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM rpg_systems WHERE name = 'Dungeons & Dragons 5e' AND is_preconfigured) THEN
        RAISE NOTICE 'Seed já aplicado, pulando.';
        RETURN;
    END IF;

    INSERT INTO rpg_systems (name, description, version, language, genre, setting, is_preconfigured)
    VALUES (
        'Dungeons & Dragons 5e',
        'Sistema clássico de fantasia medieval, disponível desde a instalação. Ficha completa da 5ª edição: atributos, salvaguardas, perícias, combate, personalidade, aparência e magias.',
        '5e',
        'Português',
        'Fantasia',
        'Mundos de fantasia medieval, com masmorras, dragões, magia e aventureiros.',
        TRUE
    )
    RETURNING id INTO v_system_id;

    INSERT INTO system_attributes
        (system_id, key, name, group_name, data_type, min_value, max_value, options, is_required, display_order)
    VALUES
        (v_system_id, 'classe_e_nivel', 'Classe e Nível', 'Identificação', 'text', NULL, NULL, NULL, FALSE, 0),
        (v_system_id, 'antecedente', 'Antecedente', 'Identificação', 'text', NULL, NULL, NULL, FALSE, 1),
        (v_system_id, 'nome_do_jogador', 'Nome do Jogador', 'Identificação', 'text', NULL, NULL, NULL, FALSE, 2),
        (v_system_id, 'raca', 'Raça', 'Identificação', 'text', NULL, NULL, NULL, FALSE, 3),
        (v_system_id, 'alinhamento', 'Alinhamento', 'Identificação', 'select', NULL, NULL, '["Leal e Bom", "Neutro e Bom", "Caótico e Bom", "Leal e Neutro", "Neutro", "Caótico e Neutro", "Leal e Mau", "Neutro e Mau", "Caótico e Mau"]'::jsonb, FALSE, 4),
        (v_system_id, 'pontos_de_experiencia', 'Pontos de Experiência', 'Identificação', 'number', 0, 9999999, NULL, FALSE, 5),
        (v_system_id, 'inspiracao', 'Inspiração', 'Atributos', 'boolean', NULL, NULL, NULL, FALSE, 6),
        (v_system_id, 'bonus_de_proficiencia', 'Bônus de Proficiência', 'Atributos', 'number', 0, 10, NULL, FALSE, 7),
        (v_system_id, 'forca', 'Força', 'Atributos', 'number', 1, 30, NULL, TRUE, 8),
        (v_system_id, 'modificador_de_forca', 'Modificador de Força', 'Atributos', 'number', -5, 10, NULL, FALSE, 9),
        (v_system_id, 'destreza', 'Destreza', 'Atributos', 'number', 1, 30, NULL, TRUE, 10),
        (v_system_id, 'modificador_de_destreza', 'Modificador de Destreza', 'Atributos', 'number', -5, 10, NULL, FALSE, 11),
        (v_system_id, 'constituicao', 'Constituição', 'Atributos', 'number', 1, 30, NULL, TRUE, 12),
        (v_system_id, 'modificador_de_constituicao', 'Modificador de Constituição', 'Atributos', 'number', -5, 10, NULL, FALSE, 13),
        (v_system_id, 'inteligencia', 'Inteligência', 'Atributos', 'number', 1, 30, NULL, TRUE, 14),
        (v_system_id, 'modificador_de_inteligencia', 'Modificador de Inteligência', 'Atributos', 'number', -5, 10, NULL, FALSE, 15),
        (v_system_id, 'sabedoria', 'Sabedoria', 'Atributos', 'number', 1, 30, NULL, TRUE, 16),
        (v_system_id, 'modificador_de_sabedoria', 'Modificador de Sabedoria', 'Atributos', 'number', -5, 10, NULL, FALSE, 17),
        (v_system_id, 'carisma', 'Carisma', 'Atributos', 'number', 1, 30, NULL, TRUE, 18),
        (v_system_id, 'modificador_de_carisma', 'Modificador de Carisma', 'Atributos', 'number', -5, 10, NULL, FALSE, 19),
        (v_system_id, 'salvaguarda_de_forca', 'Salvaguarda de Força', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 20),
        (v_system_id, 'proficiente_em_salvaguarda_de_forca', 'Proficiente em Salvaguarda de Força', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 21),
        (v_system_id, 'salvaguarda_de_destreza', 'Salvaguarda de Destreza', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 22),
        (v_system_id, 'proficiente_em_salvaguarda_de_destreza', 'Proficiente em Salvaguarda de Destreza', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 23),
        (v_system_id, 'salvaguarda_de_constituicao', 'Salvaguarda de Constituição', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 24),
        (v_system_id, 'proficiente_em_salvaguarda_de_constituicao', 'Proficiente em Salvaguarda de Constituição', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 25),
        (v_system_id, 'salvaguarda_de_inteligencia', 'Salvaguarda de Inteligência', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 26),
        (v_system_id, 'proficiente_em_salvaguarda_de_inteligencia', 'Proficiente em Salvaguarda de Inteligência', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 27),
        (v_system_id, 'salvaguarda_de_sabedoria', 'Salvaguarda de Sabedoria', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 28),
        (v_system_id, 'proficiente_em_salvaguarda_de_sabedoria', 'Proficiente em Salvaguarda de Sabedoria', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 29),
        (v_system_id, 'salvaguarda_de_carisma', 'Salvaguarda de Carisma', 'Salvaguardas', 'number', -10, 30, NULL, FALSE, 30),
        (v_system_id, 'proficiente_em_salvaguarda_de_carisma', 'Proficiente em Salvaguarda de Carisma', 'Salvaguardas', 'boolean', NULL, NULL, NULL, FALSE, 31),
        (v_system_id, 'acrobacia_des', 'Acrobacia (Des)', 'Perícias', 'number', -10, 30, NULL, FALSE, 32),
        (v_system_id, 'proficiente_em_acrobacia', 'Proficiente em Acrobacia', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 33),
        (v_system_id, 'arcanismo_int', 'Arcanismo (Int)', 'Perícias', 'number', -10, 30, NULL, FALSE, 34),
        (v_system_id, 'proficiente_em_arcanismo', 'Proficiente em Arcanismo', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 35),
        (v_system_id, 'atletismo_for', 'Atletismo (For)', 'Perícias', 'number', -10, 30, NULL, FALSE, 36),
        (v_system_id, 'proficiente_em_atletismo', 'Proficiente em Atletismo', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 37),
        (v_system_id, 'atuacao_car', 'Atuação (Car)', 'Perícias', 'number', -10, 30, NULL, FALSE, 38),
        (v_system_id, 'proficiente_em_atuacao', 'Proficiente em Atuação', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 39),
        (v_system_id, 'enganacao_car', 'Enganação (Car)', 'Perícias', 'number', -10, 30, NULL, FALSE, 40),
        (v_system_id, 'proficiente_em_enganacao', 'Proficiente em Enganação', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 41),
        (v_system_id, 'furtividade_des', 'Furtividade (Des)', 'Perícias', 'number', -10, 30, NULL, FALSE, 42),
        (v_system_id, 'proficiente_em_furtividade', 'Proficiente em Furtividade', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 43),
        (v_system_id, 'historia_int', 'História (Int)', 'Perícias', 'number', -10, 30, NULL, FALSE, 44),
        (v_system_id, 'proficiente_em_historia', 'Proficiente em História', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 45),
        (v_system_id, 'intimidacao_car', 'Intimidação (Car)', 'Perícias', 'number', -10, 30, NULL, FALSE, 46),
        (v_system_id, 'proficiente_em_intimidacao', 'Proficiente em Intimidação', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 47),
        (v_system_id, 'intuicao_sab', 'Intuição (Sab)', 'Perícias', 'number', -10, 30, NULL, FALSE, 48),
        (v_system_id, 'proficiente_em_intuicao', 'Proficiente em Intuição', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 49),
        (v_system_id, 'investigacao_int', 'Investigação (Int)', 'Perícias', 'number', -10, 30, NULL, FALSE, 50),
        (v_system_id, 'proficiente_em_investigacao', 'Proficiente em Investigação', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 51),
        (v_system_id, 'lidar_com_animais_sab', 'Lidar com Animais (Sab)', 'Perícias', 'number', -10, 30, NULL, FALSE, 52),
        (v_system_id, 'proficiente_em_lidar_com_animais', 'Proficiente em Lidar com Animais', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 53),
        (v_system_id, 'medicina_sab', 'Medicina (Sab)', 'Perícias', 'number', -10, 30, NULL, FALSE, 54),
        (v_system_id, 'proficiente_em_medicina', 'Proficiente em Medicina', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 55),
        (v_system_id, 'natureza_int', 'Natureza (Int)', 'Perícias', 'number', -10, 30, NULL, FALSE, 56),
        (v_system_id, 'proficiente_em_natureza', 'Proficiente em Natureza', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 57),
        (v_system_id, 'percepcao_sab', 'Percepção (Sab)', 'Perícias', 'number', -10, 30, NULL, FALSE, 58),
        (v_system_id, 'proficiente_em_percepcao', 'Proficiente em Percepção', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 59),
        (v_system_id, 'persuasao_car', 'Persuasão (Car)', 'Perícias', 'number', -10, 30, NULL, FALSE, 60),
        (v_system_id, 'proficiente_em_persuasao', 'Proficiente em Persuasão', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 61),
        (v_system_id, 'prestidigitacao_des', 'Prestidigitação (Des)', 'Perícias', 'number', -10, 30, NULL, FALSE, 62),
        (v_system_id, 'proficiente_em_prestidigitacao', 'Proficiente em Prestidigitação', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 63),
        (v_system_id, 'religiao_int', 'Religião (Int)', 'Perícias', 'number', -10, 30, NULL, FALSE, 64),
        (v_system_id, 'proficiente_em_religiao', 'Proficiente em Religião', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 65),
        (v_system_id, 'sobrevivencia_sab', 'Sobrevivência (Sab)', 'Perícias', 'number', -10, 30, NULL, FALSE, 66),
        (v_system_id, 'proficiente_em_sobrevivencia', 'Proficiente em Sobrevivência', 'Perícias', 'boolean', NULL, NULL, NULL, FALSE, 67),
        (v_system_id, 'sabedoria_passiva_percepcao', 'Sabedoria Passiva (Percepção)', 'Perícias', 'number', 0, 50, NULL, FALSE, 68),
        (v_system_id, 'classe_de_armadura', 'Classe de Armadura', 'Combate', 'number', 0, 40, NULL, FALSE, 69),
        (v_system_id, 'iniciativa', 'Iniciativa', 'Combate', 'number', -10, 30, NULL, FALSE, 70),
        (v_system_id, 'deslocamento', 'Deslocamento', 'Combate', 'text', NULL, NULL, NULL, FALSE, 71),
        (v_system_id, 'pontos_de_vida_maximos', 'Pontos de Vida Máximos', 'Combate', 'number', 0, 999, NULL, FALSE, 72),
        (v_system_id, 'pontos_de_vida_atuais', 'Pontos de Vida Atuais', 'Combate', 'number', 0, 999, NULL, FALSE, 73),
        (v_system_id, 'pontos_de_vida_temporarios', 'Pontos de Vida Temporários', 'Combate', 'number', 0, 999, NULL, FALSE, 74),
        (v_system_id, 'dado_de_vida', 'Dado de Vida', 'Combate', 'text', NULL, NULL, NULL, FALSE, 75),
        (v_system_id, 'total_de_dados_de_vida', 'Total de Dados de Vida', 'Combate', 'text', NULL, NULL, NULL, FALSE, 76),
        (v_system_id, 'sucessos_de_salvaguarda_contra_a_morte', 'Sucessos de Salvaguarda contra a Morte', 'Combate', 'number', 0, 3, NULL, FALSE, 77),
        (v_system_id, 'falhas_de_salvaguarda_contra_a_morte', 'Falhas de Salvaguarda contra a Morte', 'Combate', 'number', 0, 3, NULL, FALSE, 78),
        (v_system_id, 'ataque_1_nome', 'Ataque 1: Nome', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 79),
        (v_system_id, 'ataque_1_bonus_de_ataque', 'Ataque 1: Bônus de Ataque', 'Ataques e Conjuração', 'number', -10, 30, NULL, FALSE, 80),
        (v_system_id, 'ataque_1_dano_tipo', 'Ataque 1: Dano/Tipo', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 81),
        (v_system_id, 'ataque_2_nome', 'Ataque 2: Nome', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 82),
        (v_system_id, 'ataque_2_bonus_de_ataque', 'Ataque 2: Bônus de Ataque', 'Ataques e Conjuração', 'number', -10, 30, NULL, FALSE, 83),
        (v_system_id, 'ataque_2_dano_tipo', 'Ataque 2: Dano/Tipo', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 84),
        (v_system_id, 'ataque_3_nome', 'Ataque 3: Nome', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 85),
        (v_system_id, 'ataque_3_bonus_de_ataque', 'Ataque 3: Bônus de Ataque', 'Ataques e Conjuração', 'number', -10, 30, NULL, FALSE, 86),
        (v_system_id, 'ataque_3_dano_tipo', 'Ataque 3: Dano/Tipo', 'Ataques e Conjuração', 'text', NULL, NULL, NULL, FALSE, 87),
        (v_system_id, 'anotacoes_de_ataques_e_conjuracao', 'Anotações de Ataques e Conjuração', 'Ataques e Conjuração', 'longtext', NULL, NULL, NULL, FALSE, 88),
        (v_system_id, 'pecas_de_cobre_pc', 'Peças de Cobre (PC)', 'Equipamento e Moedas', 'number', 0, 99999999, NULL, FALSE, 89),
        (v_system_id, 'pecas_de_prata_pp', 'Peças de Prata (PP)', 'Equipamento e Moedas', 'number', 0, 99999999, NULL, FALSE, 90),
        (v_system_id, 'pecas_de_electro_pe', 'Peças de Electro (PE)', 'Equipamento e Moedas', 'number', 0, 99999999, NULL, FALSE, 91),
        (v_system_id, 'pecas_de_ouro_po', 'Peças de Ouro (PO)', 'Equipamento e Moedas', 'number', 0, 99999999, NULL, FALSE, 92),
        (v_system_id, 'pecas_de_platina_pl', 'Peças de Platina (PL)', 'Equipamento e Moedas', 'number', 0, 99999999, NULL, FALSE, 93),
        (v_system_id, 'equipamento', 'Equipamento', 'Equipamento e Moedas', 'longtext', NULL, NULL, NULL, FALSE, 94),
        (v_system_id, 'tracos_de_personalidade', 'Traços de Personalidade', 'Personalidade', 'longtext', NULL, NULL, NULL, FALSE, 95),
        (v_system_id, 'ideais', 'Ideais', 'Personalidade', 'longtext', NULL, NULL, NULL, FALSE, 96),
        (v_system_id, 'vinculos', 'Vínculos', 'Personalidade', 'longtext', NULL, NULL, NULL, FALSE, 97),
        (v_system_id, 'fraquezas', 'Fraquezas', 'Personalidade', 'longtext', NULL, NULL, NULL, FALSE, 98),
        (v_system_id, 'outras_proficiencias_e_idiomas', 'Outras Proficiências e Idiomas', 'Proficiências e Características', 'longtext', NULL, NULL, NULL, FALSE, 99),
        (v_system_id, 'caracteristicas_e_talentos', 'Características e Talentos', 'Proficiências e Características', 'longtext', NULL, NULL, NULL, FALSE, 100),
        (v_system_id, 'idade', 'Idade', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 101),
        (v_system_id, 'altura', 'Altura', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 102),
        (v_system_id, 'peso', 'Peso', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 103),
        (v_system_id, 'cor_dos_olhos', 'Cor dos Olhos', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 104),
        (v_system_id, 'cor_da_pele', 'Cor da Pele', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 105),
        (v_system_id, 'cor_do_cabelo', 'Cor do Cabelo', 'Aparência', 'text', NULL, NULL, NULL, FALSE, 106),
        (v_system_id, 'aparencia_do_personagem', 'Aparência do Personagem', 'Aparência', 'longtext', NULL, NULL, NULL, FALSE, 107),
        (v_system_id, 'aliados_e_organizacoes', 'Aliados e Organizações', 'Aliados, Talentos e Tesouros', 'longtext', NULL, NULL, NULL, FALSE, 108),
        (v_system_id, 'nome_do_simbolo', 'Nome do Símbolo', 'Aliados, Talentos e Tesouros', 'text', NULL, NULL, NULL, FALSE, 109),
        (v_system_id, 'caracteristicas_e_talentos_adicionais', 'Características e Talentos Adicionais', 'Aliados, Talentos e Tesouros', 'longtext', NULL, NULL, NULL, FALSE, 110),
        (v_system_id, 'tesouros', 'Tesouros', 'Aliados, Talentos e Tesouros', 'longtext', NULL, NULL, NULL, FALSE, 111),
        (v_system_id, 'classe_conjuradora', 'Classe Conjuradora', 'Magias', 'text', NULL, NULL, NULL, FALSE, 112),
        (v_system_id, 'atributo_de_conjuracao', 'Atributo de Conjuração', 'Magias', 'select', NULL, NULL, '["Inteligência", "Sabedoria", "Carisma"]'::jsonb, FALSE, 113),
        (v_system_id, 'cd_para_evitar_suas_magias', 'CD para Evitar suas Magias', 'Magias', 'number', 0, 40, NULL, FALSE, 114),
        (v_system_id, 'modificador_de_ataque_magico', 'Modificador de Ataque Mágico', 'Magias', 'number', -10, 30, NULL, FALSE, 115),
        (v_system_id, 'truques', 'Truques', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 116),
        (v_system_id, '1_circulo_total_de_espacos', '1º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 117),
        (v_system_id, '1_circulo_espacos_utilizados', '1º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 118),
        (v_system_id, '1_circulo_magias', '1º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 119),
        (v_system_id, '2_circulo_total_de_espacos', '2º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 120),
        (v_system_id, '2_circulo_espacos_utilizados', '2º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 121),
        (v_system_id, '2_circulo_magias', '2º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 122),
        (v_system_id, '3_circulo_total_de_espacos', '3º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 123),
        (v_system_id, '3_circulo_espacos_utilizados', '3º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 124),
        (v_system_id, '3_circulo_magias', '3º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 125),
        (v_system_id, '4_circulo_total_de_espacos', '4º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 126),
        (v_system_id, '4_circulo_espacos_utilizados', '4º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 127),
        (v_system_id, '4_circulo_magias', '4º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 128),
        (v_system_id, '5_circulo_total_de_espacos', '5º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 129),
        (v_system_id, '5_circulo_espacos_utilizados', '5º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 130),
        (v_system_id, '5_circulo_magias', '5º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 131),
        (v_system_id, '6_circulo_total_de_espacos', '6º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 132),
        (v_system_id, '6_circulo_espacos_utilizados', '6º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 133),
        (v_system_id, '6_circulo_magias', '6º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 134),
        (v_system_id, '7_circulo_total_de_espacos', '7º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 135),
        (v_system_id, '7_circulo_espacos_utilizados', '7º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 136),
        (v_system_id, '7_circulo_magias', '7º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 137),
        (v_system_id, '8_circulo_total_de_espacos', '8º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 138),
        (v_system_id, '8_circulo_espacos_utilizados', '8º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 139),
        (v_system_id, '8_circulo_magias', '8º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 140),
        (v_system_id, '9_circulo_total_de_espacos', '9º Círculo: Total de Espaços', 'Magias', 'number', 0, 20, NULL, FALSE, 141),
        (v_system_id, '9_circulo_espacos_utilizados', '9º Círculo: Espaços Utilizados', 'Magias', 'number', 0, 20, NULL, FALSE, 142),
        (v_system_id, '9_circulo_magias', '9º Círculo: Magias', 'Magias', 'longtext', NULL, NULL, NULL, FALSE, 143);
END $$;

-- >>> ITENS DO D&D
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
-- <<< ITENS DO D&D
