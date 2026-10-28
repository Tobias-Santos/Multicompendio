export interface SharingMember {
  user_id: string;
  name: string;
  joined_at: string;
  characters: number; // quantos personagens a pessoa tem neste sistema
}

// O que o dono do sistema vê: o link atual (ou nenhum) e quem já entrou.
export interface SharingInfo {
  invite_token: string | null;
  members: SharingMember[];
}

export interface InvitePreview {
  system_id: string;
  system_name: string;
  owner_name: string | null;
  description: string | null;
  image_url: string | null;
  relation: 'owner' | 'member' | 'new'; // a pessoa é a dona, já participa, ou é nova no sistema
}

export interface InviteAccepted {
  system_id: string;
  relation: 'owner' | 'member' | 'joined';
}
