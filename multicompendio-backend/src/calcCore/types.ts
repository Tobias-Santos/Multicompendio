// Núcleo do cálculo dos atributos calculados (RF14).
// Esta pasta é IDÊNTICA no back-end e no front-end (veja tools/core-checksum.mjs): o mesmo código
// calcula na tela, no servidor e no PDF.

export type CalcOperand = { k: 'attr'; id: string } | { k: 'num'; v: number };

export const CALC_OPS = ['add', 'sub', 'mul', 'div', 'atleast', 'atmost', 'addif', 'floor', 'ceil', 'round'] as const;
export type CalcOp = (typeof CALC_OPS)[number];

// Um passo da conta. `x` é o valor do passo (quando a operação usa um); `cond` é o campo
// marcável do passo condicional ("somar X se o campo estiver marcado").
export interface CalcStep { op: CalcOp; x?: CalcOperand; cond?: string }

// A conta: começa com um valor e aplica os passos em ordem, da esquerda para a direita.
export interface CalcDef { start: CalcOperand; steps: CalcStep[] }

// O que o núcleo precisa saber de cada atributo do sistema.
export interface CalcAttr { id: string; name: string; type: string; calc?: CalcDef | null }

export const MAX_STEPS = 30;

export class CalcError extends Error {
  constructor(message: string) { super(message); this.name = 'CalcError'; }
}
