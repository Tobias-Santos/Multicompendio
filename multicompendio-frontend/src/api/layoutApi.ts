import { SheetLayout } from '../layoutCore';
import { request } from './http';

// Layout da ficha de um sistema (v1.8): onde cada seção e cada campo ficam na folha, em milímetros.
export interface LayoutView {
  layout: SheetLayout;
  tray: string[]; // atributos fora da folha (a "gaveta"), na ordem do cadastro
  version: number; // 0 = ainda não há layout salvo
  source: 'saved' | 'curated' | 'auto';
  can_edit: boolean;
  repaired: boolean; // o layout salvo deixou de ser válido (ex.: um atributo mudou de tipo) e foi ajustado ao ler
}

export function getLayout(systemId: string): Promise<LayoutView> {
  return request(`/systems/${systemId}/layout`);
}

// Grava só se `version` ainda é a versão atual no servidor (0 = ainda não há layout salvo); senão, 409 "stale_layout".
export function saveLayout(systemId: string, layout: SheetLayout, version: number): Promise<LayoutView & { dropped: number }> {
  return request(`/systems/${systemId}/layout`, { method: 'PUT', body: JSON.stringify({ layout, version }) });
}

// Volta ao layout automático (apaga o salvo).
export function resetLayout(systemId: string): Promise<LayoutView> {
  return request(`/systems/${systemId}/layout`, { method: 'DELETE' });
}
