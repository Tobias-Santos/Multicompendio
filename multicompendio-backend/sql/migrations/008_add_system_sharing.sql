-- Migração incremental — v1.4 (compartilhamento de sistemas e personagens públicos).
-- Roda em cima de um banco que já tem a v1.3 aplicada. Não altera dados existentes:
-- todo personagem continua privado e todo sistema continua sem membros.

-- Quem entrou em um sistema de outra pessoa pelo link de convite.
-- (O dono do sistema não aparece aqui: ele já é o dono.)
CREATE TABLE IF NOT EXISTS system_members (
    system_id   UUID NOT NULL REFERENCES rpg_systems(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (system_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_system_members_user ON system_members(user_id);

-- Link de convite do sistema: no máximo um ativo por sistema.
-- Gerar um novo link troca o código e invalida o anterior; apagar a linha desativa o convite.
CREATE TABLE IF NOT EXISTS system_invites (
    system_id   UUID PRIMARY KEY REFERENCES rpg_systems(id) ON DELETE CASCADE,
    token       VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visibilidade do personagem para as outras pessoas do mesmo sistema. Privado por padrão.
-- (Nos sistemas pré-configurados o personagem é sempre privado: a aplicação não permite torná-lo público.)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
