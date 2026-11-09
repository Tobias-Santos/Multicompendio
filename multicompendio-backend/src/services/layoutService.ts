import { StaleLayoutError, ValidationError } from '../errors';
import * as attributesRepo from '../repositories/attributesRepository';
import * as layoutsRepo from '../repositories/layoutsRepository';
import { LayoutAttribute, SheetLayout, ShapeKey, autoLayout, parseLayout, reconcile, repairLayout, trayOf, validateLayout } from '../layoutCore';
import { RpgSystem, SystemAttribute } from '../types/system';
import { loadEditableSystem, loadVisibleSystem } from './systemsService';

// Layout da ficha de um sistema (v1.8): um documento por sistema, com a posição e o tamanho de cada campo na folha.
// Quem vê o sistema lê; só o dono grava, e o sistema pré-instalado nunca é gravado (usa um layout curado).

export interface LayoutView {
  layout: SheetLayout;
  tray: string[]; // atributos fora da folha (a "gaveta"), na ordem do cadastro
  version: number; // 0 = ainda não há layout salvo
  source: 'saved' | 'curated' | 'auto';
  can_edit: boolean;
  repaired: boolean; // o layout salvo deixou de ser válido (ex.: um atributo mudou de tipo) e foi ajustado ao ler
}

export const toLayoutAttributes = (attrs: SystemAttribute[]): LayoutAttribute[] =>
  attrs.map((a) => ({ id: a.id, name: a.name, type: a.data_type, group: a.group_name, order: a.display_order }));

// Primeiro passo do layout curado do D&D 5e: o layout automático com formato e altura próprios nos números de destaque.
// (O desenho completo, parecido com a ficha oficial, é um trabalho de design à parte.)
const DND_HIGHLIGHTS: Record<string, { h: number; shape?: ShapeKey }> = {
  'Combate|Classe de Armadura': { h: 22, shape: 'shield' },
  'Combate|Iniciativa': { h: 22, shape: 'ellipse' },
  'Atributos|Bônus de Proficiência': { h: 22, shape: 'ellipse' },
  'Atributos|Modificador de Força': { h: 20, shape: 'ellipse' },
  'Atributos|Modificador de Destreza': { h: 20, shape: 'ellipse' },
  'Atributos|Modificador de Constituição': { h: 20, shape: 'ellipse' },
  'Atributos|Modificador de Inteligência': { h: 20, shape: 'ellipse' },
  'Atributos|Modificador de Sabedoria': { h: 20, shape: 'ellipse' },
  'Atributos|Modificador de Carisma': { h: 20, shape: 'ellipse' },
  // textos longos que costumam ocupar várias linhas
  'Equipamento e Moedas|Equipamento': { h: 46 },
  'Proficiências e Características|Características e Talentos': { h: 42 },
  'Proficiências e Características|Outras Proficiências e Idiomas': { h: 36 },
  'Aliados, Talentos e Tesouros|Características e Talentos Adicionais': { h: 38 },
  'Atributos|Força': { h: 20, shape: 'rounded' },
  'Atributos|Destreza': { h: 20, shape: 'rounded' },
  'Atributos|Constituição': { h: 20, shape: 'rounded' },
  'Atributos|Inteligência': { h: 20, shape: 'rounded' },
  'Atributos|Sabedoria': { h: 20, shape: 'rounded' },
  'Atributos|Carisma': { h: 20, shape: 'rounded' },
};

function curatedLayout(system: RpgSystem, attrs: LayoutAttribute[]): SheetLayout | null {
  if (!system.is_preconfigured || !/dungeons/i.test(system.name)) return null;
  const overrides: Record<string, { h: number; shape?: ShapeKey }> = {};
  for (const a of attrs) {
    const o = DND_HIGHLIGHTS[`${(a.group ?? '').trim()}|${a.name}`];
    if (o) overrides[a.id] = o;
  }
  return autoLayout(attrs, { overrides });
}

function buildView(system: RpgSystem, attrs: LayoutAttribute[], stored: layoutsRepo.StoredLayout | null, canEdit: boolean): LayoutView {
  if (stored) {
    const parsed = parseLayout(stored.layout);
    if (parsed.layout) {
      let layout = reconcile(parsed.layout, attrs).layout;
      let repaired = false;
      // Um layout válido é devolvido exatamente como foi salvo; só um que deixou de ser válido é ajustado.
      if (validateLayout(layout, attrs).length) { layout = repairLayout(layout, attrs); repaired = true; }
      return { layout, tray: trayOf(layout, attrs), version: stored.version, source: 'saved', can_edit: canEdit, repaired };
    }
  }
  const curated = stored ? null : curatedLayout(system, attrs);
  const layout = curated ?? autoLayout(attrs);
  return { layout, tray: trayOf(layout, attrs), version: stored ? stored.version : 0, source: curated ? 'curated' : 'auto', can_edit: canEdit, repaired: !!stored };
}

async function load(system: RpgSystem, userId: string): Promise<LayoutView> {
  const attrs = toLayoutAttributes(await attributesRepo.listAttributesBySystem(system.id));
  const stored = await layoutsRepo.findLayout(system.id);
  return buildView(system, attrs, stored, !system.is_preconfigured && system.owner_user_id === userId);
}

export async function getLayoutView(systemId: string, userId: string): Promise<LayoutView> {
  return load(await loadVisibleSystem(systemId, userId), userId);
}

// O layout que vale para exportar (PDF): o salvo, o curado ou o automático.
export async function resolveLayout(system: RpgSystem, userId: string): Promise<LayoutView> {
  return load(system, userId);
}

export async function saveLayout(systemId: string, userId: string, body: unknown): Promise<LayoutView & { dropped: number }> {
  await loadEditableSystem(systemId, userId); // 404 para quem não vê, 403 para quem não é o dono ou no sistema pré-instalado
  if (typeof body !== 'object' || body === null) throw new ValidationError('Envie o layout e a versão em que ele se baseia.');
  const { layout: raw, version } = body as { layout?: unknown; version?: unknown };
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new ValidationError('Faltou a versão do layout em que esta alteração se baseia (0 se ainda não há layout salvo).');
  }
  const parsed = parseLayout(raw);
  if (!parsed.layout) throw new ValidationError(`O layout não pôde ser lido: ${parsed.errors.slice(0, 3).join(' ')}`);

  const attrs = toLayoutAttributes(await attributesRepo.listAttributesBySystem(systemId));
  const { layout, dropped } = reconcile(parsed.layout, attrs); // campos de atributos apagados nesse meio-tempo saem em silêncio
  const problems = validateLayout(layout, attrs);
  if (problems.length) throw new ValidationError(`O layout não pode ser salvo: ${problems.slice(0, 3).join(' ')}`);

  const saved = await layoutsRepo.saveLayout(systemId, userId, layout, version);
  if (saved === null) {
    const current = await layoutsRepo.findLayout(systemId);
    throw new StaleLayoutError('O layout foi alterado em outra aba ou dispositivo. Recarregue para ver a versão mais recente.', current ? current.version : 0);
  }
  return { layout, tray: trayOf(layout, attrs), version: saved, source: 'saved', can_edit: true, repaired: false, dropped: dropped.length };
}

// Volta ao layout automático (apaga o salvo). Só o dono.
export async function resetLayout(systemId: string, userId: string): Promise<LayoutView> {
  const system = await loadEditableSystem(systemId, userId);
  await layoutsRepo.deleteLayout(systemId);
  return load(system, userId);
}
