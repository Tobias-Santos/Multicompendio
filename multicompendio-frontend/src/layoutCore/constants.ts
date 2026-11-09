import { FieldType } from './types';

export const CW = 190; // largura útil da folha (210 − 2 × 10 mm de margem)
export const BAR = 6.5; // faixa do título da seção
export const BAR_GAP = 1.5; // espaço entre a faixa e o corpo
export const SEC_GAP = 3.5; // espaço padrão entre seções
export const HEAD = 17; // cabeçalho (nome do personagem) da primeira página
export const USABLE = 273; // altura útil de uma página (297 − 10 de cima − 14 do rodapé)
export const GAP = 1.8; // espaço padrão entre campos
export const MIN_SEC_H = 10;
export const MIN_SEC_W = 36;
export const MAX_BODY_H = USABLE - BAR - BAR_GAP; // a maior altura que o corpo de uma seção pode ter (uma página)

// Limites de tamanho do documento (protegem o servidor de um layout absurdo).
export const LIMITS = { pages: 30, sections: 80, itemsPerSection: 400, totalItems: 2000, titleLength: 60, idLength: 64 };

// A primeira página perde o alto para o cabeçalho; as demais começam na margem.
export const pageTop = (page: number): number => (page === 1 ? HEAD : 0);
export const outerHeight = (s: { h: number }): number => BAR + BAR_GAP + s.h;

export const MIN_SIZE: Record<FieldType, [number, number]> = {
  number: [12, 10],
  text: [18, 10],
  select: [18, 10],
  boolean: [16, 6],
  longtext: [30, 14],
  text_number: [30, 16],
};

export const DEFAULT_SIZE: Record<FieldType, [number, number]> = {
  number: [28, 16],
  text: [62, 12],
  select: [62, 12],
  boolean: [44, 8],
  longtext: [150, 28],
  text_number: [150, 28],
};

export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const r2 = (n: number): number => Math.round(n * 100) / 100;
// arredonda para cima só até a primeira casa (inteiros fariam as seções crescerem a cada gravação)
export const ceil1 = (n: number): number => Math.ceil(n * 10 - 1e-6) / 10;
// arredonda para baixo até a primeira casa: posições arredondadas assim nunca empurram um campo para fora do limite
export const floor1 = (n: number): number => Math.floor(n * 10 + 1e-6) / 10;
export const clamp = (n: number, a: number, b: number): number => Math.max(a, Math.min(b, n));
