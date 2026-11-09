// Núcleo do layout da ficha (v1.8). TypeScript puro, sem dependência do servidor nem do navegador:
// a mesma cópia é usada pelo editor (front-end), pela validação e pelo gerador de PDF (back-end).
// Todas as medidas são em milímetros, na folha A4.

export type FieldType = 'number' | 'text' | 'longtext' | 'boolean' | 'select' | 'text_number';

export type ShapeKey = 'rect' | 'rounded' | 'pill' | 'ellipse' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'shield';

// O que o layout precisa saber de cada atributo do sistema.
export interface LayoutAttribute {
  id: string;
  name: string;
  type: FieldType;
  group: string | null; // seção em que o atributo aparece no cadastro do sistema
  order: number;
}

// Um campo posicionado: x e y a partir do canto do corpo da seção; w e h são o tamanho da caixa.
export interface LayoutItem {
  attributeId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: ShapeKey;
}

// Uma seção: faixa de título + corpo. x e y são a posição na página (a partir da margem); w e h, o tamanho do corpo.
export interface LayoutSection {
  id: string;
  title: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  items: LayoutItem[];
}

// Tamanho e formato lembrados de um campo que está na gaveta (para voltar igual à folha).
export interface MemoEntry {
  w?: number;
  h?: number;
  shape?: ShapeKey;
}

// Os campos que não estão em nenhuma seção ficam "na gaveta": não precisam ser guardados, são os que sobram.
export interface SheetLayout {
  pages: number;
  sections: LayoutSection[];
  memo: Record<string, MemoEntry>;
}
