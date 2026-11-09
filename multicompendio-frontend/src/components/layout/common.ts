import { CSSProperties } from 'react';
import { FieldType } from '../../layoutCore';

export type Selection = { kind: 'field'; id: string } | { kind: 'sec'; id: string };

export const TYPE_LABELS: Record<FieldType, string> = {
  number: 'Número',
  text: 'Texto',
  select: 'Lista de opções',
  boolean: 'Verdadeiro ou falso',
  longtext: 'Texto longo',
  text_number: 'Texto com número',
};

export const fmt = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');
// variáveis CSS (--sx etc.) dentro de um style do React
export const vars = (o: Record<string, string | number>): CSSProperties => o as unknown as CSSProperties;
