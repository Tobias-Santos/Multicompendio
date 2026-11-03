import * as attributesRepo from '../repositories/attributesRepository';
import { ValidationError } from '../errors';
import { PdfOptions, buildBlankSheetPdf, buildCharacterPdf, buildItemPdf } from '../pdf';
import { blockFrom } from '../pdf/items';
import { Paper } from '../pdf/theme';
import { getCharacter } from './charactersService';
import { getInventory, getItem } from './itemsService';
import { getStory } from './storiesService';
import { loadVisibleSystem } from './systemsService';

// Exportação em PDF. Quem pode exportar é quem já pode ver: o dono do personagem ou, se ele é público,
// as outras pessoas do sistema. O inventário traz só os itens que quem exporta pode ver, e a história
// só aparece para quem pode lê-la. Tudo passa pelas mesmas checagens de acesso da leitura na tela.

export interface PdfResult {
  buffer: Buffer;
  filename: string;
}

const PAPERS: Paper[] = ['a4', 'letter'];

// Lê as opções da consulta (?paper=a4&inventory=1&story=1&hideEmpty=0). Valor desconhecido é erro, não palpite.
export function parseOptions(query: Record<string, unknown>): PdfOptions {
  const flag = (name: string, fallback: boolean): boolean => {
    const raw = query[name];
    if (raw === undefined || raw === '') return fallback;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    throw new ValidationError(`O valor de "${name}" precisa ser 1 ou 0.`);
  };
  const paper = (query.paper ?? 'a4') as string;
  if (!PAPERS.includes(paper as Paper)) throw new ValidationError('O papel precisa ser "a4" ou "letter" (carta).');
  return {
    paper: paper as Paper,
    inventory: flag('inventory', true),
    story: flag('story', true),
    hideEmpty: flag('hideEmpty', false),
  };
}

// Nome de arquivo: sem barras e outros caracteres que o sistema operacional não aceita.
function fileName(base: string, suffix: string): string {
  const clean = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'multicompendio';
  return `${clean} - ${suffix}.pdf`;
}

export async function characterPdf(id: string, userId: string, options: PdfOptions): Promise<PdfResult> {
  const detail = await getCharacter(id, userId); // 404 para quem não pode ver
  const inventory = options.inventory ? await getInventory(id, userId) : null;
  const story = options.story ? (await getStory(id, userId)).content : null;
  const buffer = await buildCharacterPdf(
    {
      systemName: detail.character.system_name,
      characterName: detail.character.name,
      ownerName: detail.character.owner_name,
      attributes: detail.attributes,
      values: detail.values,
      inventory,
      story,
    },
    options,
  );
  return { buffer, filename: fileName(detail.character.name, 'ficha') };
}

export async function blankSheetPdf(systemId: string, userId: string, options: PdfOptions): Promise<PdfResult> {
  const system = await loadVisibleSystem(systemId, userId);
  const attributes = await attributesRepo.listAttributesBySystem(systemId);
  const buffer = await buildBlankSheetPdf(system.name, attributes, options);
  return { buffer, filename: fileName(system.name, 'ficha em branco') };
}

export async function itemPdf(itemId: string, userId: string, options: PdfOptions): Promise<PdfResult> {
  const detail = await getItem(itemId, userId); // 404 para quem não pode ver o item
  const { item } = detail;
  const block = blockFrom(item.name, item.is_preinstalled, item.owner_name, detail.values, detail.fields);
  const buffer = await buildItemPdf(item.system_name, block, options);
  return { buffer, filename: fileName(item.name, 'bloco') };
}
