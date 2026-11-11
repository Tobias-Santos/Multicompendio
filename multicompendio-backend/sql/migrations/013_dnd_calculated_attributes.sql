-- Sistema D&D 5e pré-instalado: modificadores, salvaguardas, perícias, iniciativa e percepção passiva
-- passam a ser atributos calculados (RF14). Depende da 012. Idempotente; não faz nada se o D&D não existir.
-- Os valores que já tinham sido digitados nesses campos ficam no banco, mas deixam de ser usados.

-- >>> CONTAS DO D&D
-- Atributos calculados do D&D 5e (RF14): modificadores, salvaguardas, perícias, iniciativa e percepção passiva
-- deixam de ser digitados e passam a ser calculados a partir de outros. O Bônus de Proficiência continua
-- manual (depende do nível). Idempotente: só converte o que ainda é um número comum.
-- Este bloco é idêntico em sql/seed.sql (instalação nova) e na migração 013 (bancos já instalados).
SET client_encoding = 'UTF8';

CREATE OR REPLACE FUNCTION pg_temp.dnd_id(sid uuid, k text) RETURNS text LANGUAGE sql AS
$f$ SELECT id::text FROM system_attributes WHERE system_id = $1 AND key = $2 $f$;

CREATE OR REPLACE FUNCTION pg_temp.dnd_set(sid uuid, target text, def jsonb) RETURNS void LANGUAGE sql AS
$f$ UPDATE system_attributes
       SET data_type = 'calculated', calc = $3, min_value = NULL, max_value = NULL,
           default_value = NULL, options = NULL, is_required = FALSE
     WHERE system_id = $1 AND key = $2 AND data_type = 'number' $f$;

DO $dnd_calc$
DECLARE
    sid   UUID;
    prof  TEXT;
    base  TEXT;
    ab    RECORD;
    sk    RECORD;
    n10   JSONB := '{"k":"num","v":10}';
    n2    JSONB := '{"k":"num","v":2}';
BEGIN
    SELECT id INTO sid FROM rpg_systems
     WHERE is_preconfigured AND name ILIKE 'Dungeons & Dragons%' ORDER BY created_at LIMIT 1;
    IF sid IS NULL THEN RETURN; END IF;
    prof := pg_temp.dnd_id(sid, 'bonus_de_proficiencia');
    IF prof IS NULL THEN RETURN; END IF;

    FOR ab IN SELECT * FROM (VALUES ('forca'), ('destreza'), ('constituicao'), ('inteligencia'), ('sabedoria'), ('carisma')) AS t(slug) LOOP
        -- modificador = (habilidade - 10) / 2, arredondado para baixo
        IF pg_temp.dnd_id(sid, ab.slug) IS NOT NULL THEN
            PERFORM pg_temp.dnd_set(sid, 'modificador_de_' || ab.slug, jsonb_build_object(
                'start', jsonb_build_object('k', 'attr', 'id', pg_temp.dnd_id(sid, ab.slug)),
                'steps', jsonb_build_array(
                    jsonb_build_object('op', 'sub', 'x', n10),
                    jsonb_build_object('op', 'div', 'x', n2),
                    jsonb_build_object('op', 'floor'))));
        END IF;
        -- salvaguarda = modificador + bônus de proficiência, se proficiente
        IF pg_temp.dnd_id(sid, 'modificador_de_' || ab.slug) IS NOT NULL
           AND pg_temp.dnd_id(sid, 'proficiente_em_salvaguarda_de_' || ab.slug) IS NOT NULL THEN
            PERFORM pg_temp.dnd_set(sid, 'salvaguarda_de_' || ab.slug, jsonb_build_object(
                'start', jsonb_build_object('k', 'attr', 'id', pg_temp.dnd_id(sid, 'modificador_de_' || ab.slug)),
                'steps', jsonb_build_array(jsonb_build_object(
                    'op', 'addif', 'x', jsonb_build_object('k', 'attr', 'id', prof),
                    'cond', pg_temp.dnd_id(sid, 'proficiente_em_salvaguarda_de_' || ab.slug)))));
        END IF;
    END LOOP;

    -- perícia = modificador da habilidade + bônus de proficiência, se proficiente
    FOR sk IN SELECT * FROM (VALUES
        ('acrobacia', 'des'), ('arcanismo', 'int'), ('atletismo', 'for'), ('atuacao', 'car'), ('enganacao', 'car'),
        ('furtividade', 'des'), ('historia', 'int'), ('intimidacao', 'car'), ('intuicao', 'sab'), ('investigacao', 'int'),
        ('lidar_com_animais', 'sab'), ('medicina', 'sab'), ('natureza', 'int'), ('percepcao', 'sab'), ('persuasao', 'car'),
        ('prestidigitacao', 'des'), ('religiao', 'int'), ('sobrevivencia', 'sab')) AS t(slug, hab) LOOP
        base := 'modificador_de_' || CASE sk.hab WHEN 'for' THEN 'forca' WHEN 'des' THEN 'destreza' WHEN 'con' THEN 'constituicao'
                                                 WHEN 'int' THEN 'inteligencia' WHEN 'sab' THEN 'sabedoria' ELSE 'carisma' END;
        IF pg_temp.dnd_id(sid, base) IS NOT NULL AND pg_temp.dnd_id(sid, 'proficiente_em_' || sk.slug) IS NOT NULL THEN
            PERFORM pg_temp.dnd_set(sid, sk.slug || '_' || sk.hab, jsonb_build_object(
                'start', jsonb_build_object('k', 'attr', 'id', pg_temp.dnd_id(sid, base)),
                'steps', jsonb_build_array(jsonb_build_object(
                    'op', 'addif', 'x', jsonb_build_object('k', 'attr', 'id', prof),
                    'cond', pg_temp.dnd_id(sid, 'proficiente_em_' || sk.slug)))));
        END IF;
    END LOOP;

    -- iniciativa = modificador de Destreza
    IF pg_temp.dnd_id(sid, 'modificador_de_destreza') IS NOT NULL THEN
        PERFORM pg_temp.dnd_set(sid, 'iniciativa', jsonb_build_object(
            'start', jsonb_build_object('k', 'attr', 'id', pg_temp.dnd_id(sid, 'modificador_de_destreza')), 'steps', '[]'::jsonb));
    END IF;
    -- sabedoria passiva (Percepção) = 10 + bônus da perícia Percepção
    IF pg_temp.dnd_id(sid, 'percepcao_sab') IS NOT NULL THEN
        PERFORM pg_temp.dnd_set(sid, 'sabedoria_passiva_percepcao', jsonb_build_object(
            'start', n10,
            'steps', jsonb_build_array(jsonb_build_object('op', 'add', 'x', jsonb_build_object('k', 'attr', 'id', pg_temp.dnd_id(sid, 'percepcao_sab'))))));
    END IF;
END
$dnd_calc$;
-- <<< CONTAS DO D&D
