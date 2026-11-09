import { MIN_SIZE } from './constants';
import { FieldType, ShapeKey } from './types';

export const SHAPE_KEYS: ShapeKey[] = ['rect', 'rounded', 'pill', 'ellipse', 'circle', 'diamond', 'triangle', 'hexagon', 'shield'];

export const SHAPE_LABELS: Record<ShapeKey, string> = {
  rect: 'Retângulo',
  rounded: 'Arredondado',
  pill: 'Pílula',
  ellipse: 'Elipse',
  circle: 'Círculo',
  diamond: 'Losango',
  triangle: 'Triângulo',
  hexagon: 'Hexágono',
  shield: 'Escudo',
};

// Formas das pontas, num quadrado de 0 a 100 que se estica até a caixa (usadas pelo editor e pelo PDF).
export const SHAPE_POLYGONS: Partial<Record<ShapeKey, Array<[number, number]>>> = {
  diamond: [[50, 1], [99, 50], [50, 99], [1, 50]],
  triangle: [[50, 2], [99, 98], [1, 98]],
  hexagon: [[1, 50], [25, 3], [75, 3], [99, 50], [75, 97], [25, 97]],
};
export const SHIELD_PATH = 'M2,3 H98 V58 Q98,86 50,98 Q2,86 2,58 Z';

// Texto longo e "texto com número" só aceitam formas em que um parágrafo cabe.
const LONG_SHAPES: ShapeKey[] = ['rect', 'rounded'];
export const allowedShapes = (type: FieldType): ShapeKey[] => (type === 'longtext' || type === 'text_number' ? LONG_SHAPES : SHAPE_KEYS);
export const shapeAllowed = (type: FieldType, shape: ShapeKey): boolean => allowedShapes(type).includes(shape);

// O círculo é sempre quadrado: o lado mínimo é o maior dos dois mínimos do tipo.
export function minSize(type: FieldType, shape: ShapeKey): [number, number] {
  const [w, h] = MIN_SIZE[type];
  return shape === 'circle' ? [Math.max(w, h), Math.max(w, h)] : [w, h];
}

// O quanto o conteúdo se afasta de cada lado (esquerda, direita, cima, baixo, em mm) para ficar dentro da forma.
export function shapeInsets(shape: ShapeKey, w: number, h: number): [number, number, number, number] {
  switch (shape) {
    case 'rounded': return [0.9, 0.9, 0.9, 0.9];
    case 'pill': return [h * 0.3, h * 0.3, 0, 0];
    case 'ellipse':
    case 'circle': return [w * 0.146, w * 0.146, h * 0.146, h * 0.146];
    case 'diamond': return [w * 0.25, w * 0.25, h * 0.25, h * 0.25];
    case 'triangle': return [w * 0.25, w * 0.25, h * 0.48, h * 0.03];
    case 'hexagon': return [w * 0.15, w * 0.15, h * 0.06, h * 0.06];
    case 'shield': return [w * 0.06, w * 0.06, h * 0.03, h * 0.2];
    default: return [0, 0, 0, 0];
  }
}
