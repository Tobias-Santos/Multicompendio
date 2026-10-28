import { InviteAccepted, InvitePreview, SharingInfo } from '../types/sharing';
import { request } from './http';

export function getSharing(systemId: string): Promise<SharingInfo> {
  return request(`/systems/${systemId}/sharing`);
}

// Gera o link de convite; se já havia um, ele é trocado e o anterior deixa de valer.
export function createInvite(systemId: string): Promise<{ invite_token: string }> {
  return request(`/systems/${systemId}/sharing/invite`, { method: 'POST' });
}

export function disableInvite(systemId: string): Promise<void> {
  return request(`/systems/${systemId}/sharing/invite`, { method: 'DELETE' });
}

export function leaveSystem(systemId: string): Promise<void> {
  return request(`/systems/${systemId}/membership`, { method: 'DELETE' });
}

export function previewInvite(token: string): Promise<InvitePreview> {
  return request(`/invites/${encodeURIComponent(token)}`);
}

export function acceptInvite(token: string): Promise<InviteAccepted> {
  return request(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
}
