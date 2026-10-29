import { randomBytes } from 'crypto';
import * as systemsRepo from '../repositories/systemsRepository';
import * as sharingRepo from '../repositories/sharingRepository';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import * as itemsRepo from '../repositories/itemsRepository';
import { loadVisibleSystem } from './systemsService';

// Compartilhamento de sistemas (v1.4).
//  - o dono gera um link de convite; quem aceita passa a ver o sistema (só leitura) e a criar
//    personagens nele;
//  - o link vale até ser trocado ou desativado; trocar não tira quem já entrou;
//  - só quem criou o sistema gerencia o link; sistemas pré-configurados não têm convite
//    (já são de todos);
//  - quem entrou só sai se não tiver personagens no sistema.

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,64}$/;

// Só o dono de um sistema (não pré-configurado) gerencia o compartilhamento.
async function loadOwnedSystem(systemId: string, userId: string) {
  const system = await loadVisibleSystem(systemId, userId);
  if (system.is_preconfigured) {
    throw new ForbiddenError('O sistema pré-instalado não precisa de convite: ele já está disponível para todos.');
  }
  if (system.owner_user_id !== userId) {
    throw new ForbiddenError('Só quem criou o sistema pode gerenciar o compartilhamento.');
  }
  return system;
}

export async function getSharing(systemId: string, userId: string) {
  await loadOwnedSystem(systemId, userId);
  const [invite_token, members] = await Promise.all([
    sharingRepo.getInviteToken(systemId),
    sharingRepo.listMembers(systemId),
  ]);
  return { invite_token, members };
}

// Gera o link de convite. Se já havia um, ele é substituído e o antigo para de funcionar.
export async function createInvite(systemId: string, userId: string): Promise<{ invite_token: string }> {
  await loadOwnedSystem(systemId, userId);
  const token = randomBytes(24).toString('base64url');
  await sharingRepo.saveInviteToken(systemId, token);
  return { invite_token: token };
}

export async function disableInvite(systemId: string, userId: string): Promise<void> {
  await loadOwnedSystem(systemId, userId);
  await sharingRepo.deleteInvite(systemId);
}

async function systemForToken(token: string) {
  if (!TOKEN_FORMAT.test(token)) throw new NotFoundError('Este convite não existe ou foi desativado.');
  const systemId = await sharingRepo.findSystemIdByToken(token);
  const system = systemId ? await systemsRepo.findSystemById(systemId) : null;
  if (!system) throw new NotFoundError('Este convite não existe ou foi desativado.');
  return system;
}

// Mostra a que sistema o convite leva, antes de a pessoa aceitar.
export async function previewInvite(token: string, userId: string) {
  const system = await systemForToken(token);
  const relation =
    system.owner_user_id === userId ? 'owner' : (await sharingRepo.isMember(system.id, userId)) ? 'member' : 'new';
  return {
    system_id: system.id,
    system_name: system.name,
    owner_name: system.owner_name,
    description: system.description,
    image_url: system.image_url,
    relation,
  };
}

// Aceita o convite. Repetir é inofensivo: quem já é dono ou membro só recebe o sistema de volta.
export async function acceptInvite(token: string, userId: string) {
  const system = await systemForToken(token);
  if (system.owner_user_id === userId) return { system_id: system.id, relation: 'owner' as const };
  if (await sharingRepo.isMember(system.id, userId)) return { system_id: system.id, relation: 'member' as const };
  await sharingRepo.addMember(system.id, userId);
  return { system_id: system.id, relation: 'joined' as const };
}

// A pessoa deixa um sistema em que entrou por convite — só se não tiver personagens nele.
export async function leaveSystem(systemId: string, userId: string): Promise<void> {
  if (!(await sharingRepo.isMember(systemId, userId))) throw new NotFoundError('Você não participa deste sistema.');
  const characters = await sharingRepo.countCharactersOf(systemId, userId);
  if (characters > 0) {
    throw new ConflictError(
      `Você não pode sair enquanto tiver ${characters === 1 ? '1 personagem' : `${characters} personagens`} neste sistema. Exclua-${characters === 1 ? 'o' : 'os'} antes.`,
    );
  }
  const items = await itemsRepo.countByOwnerInSystem(systemId, userId);
  if (items > 0) {
    throw new ConflictError(
      `Você não pode sair enquanto tiver ${items === 1 ? '1 item' : `${items} itens`} neste sistema. Exclua-${items === 1 ? 'o' : 'os'} antes.`,
    );
  }
  await sharingRepo.removeMember(systemId, userId);
}
