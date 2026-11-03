// Aparência da ficha em PDF (layout genérico do Multicompêndio).
// Pensada para imprimir em preto e branco: o destaque é só um filete fino e nada depende de cor.

export const COLORS = {
  ink: '#1f1b16',
  muted: '#6b6358',
  line: '#b9b2a6',
  bar: '#e8e4dc',
  accent: '#a8223a',
  white: '#ffffff',
};

// Nomes registrados no documento (os arquivos ficam em assets/fonts).
export const FONT = {
  regular: 'WorkSans',
  italic: 'WorkSans-Italic',
  semi: 'WorkSans-Semi',
  semiItalic: 'WorkSans-SemiItalic',
  display: 'Fraunces',
  displaySemi: 'Fraunces-Semi',
};

export type Paper = 'a4' | 'letter';

// Tamanhos em pontos (1 pt = 1/72 de polegada).
export const PAPERS: Record<Paper, { width: number; height: number; label: string }> = {
  a4: { width: 595.28, height: 841.89, label: 'A4' },
  letter: { width: 612, height: 792, label: 'Carta' },
};

export const MARGIN = 40; // margem lateral e do topo
export const BOTTOM = 52; // espaço reservado ao rodapé
export const GAP = 6; // espaço entre caixas
