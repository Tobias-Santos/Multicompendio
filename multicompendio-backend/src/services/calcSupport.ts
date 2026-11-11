// Ponte entre os atributos do sistema e o núcleo de cálculo (src/calcCore).
import { CalcAttr, CalcDef, CalcError, evaluateAll, parseCalcDef, validateCalc } from '../calcCore';
import { ValidationError } from '../errors';
import { CharacterValues } from '../types/character';
import { SystemAttribute } from '../types/system';

export const toCalcAttrs = (list: SystemAttribute[]): CalcAttr[] =>
  list.map((a) => ({ id: a.id, name: a.name, type: a.data_type, calc: a.calc ?? null }));

// Confere a conta de um atributo calculado: o erro do núcleo vira erro de validação (400).
export function checkCalc(raw: unknown, self: { id: string; name: string }, siblings: SystemAttribute[]): CalcDef {
  try {
    const def = parseCalcDef(raw);
    validateCalc(def, self, toCalcAttrs(siblings));
    return def;
  } catch (err) {
    if (err instanceof CalcError) throw new ValidationError(err.message);
    throw err;
  }
}

// Valores calculados de um personagem (atributo calculado → número, ou null se faltar algum valor).
export function computedFor(attributes: SystemAttribute[], values: CharacterValues): Record<string, number | null> {
  return evaluateAll(toCalcAttrs(attributes), values as Record<string, unknown>).values;
}

// Para o PDF e o layout, o atributo calculado se comporta como um número.
export const asNumberIfCalculated = (a: SystemAttribute): SystemAttribute =>
  a.data_type === 'calculated' ? { ...a, data_type: 'number', min_value: null, max_value: null, calc: null } : a;

export function withComputed(values: CharacterValues, computed: Record<string, number | null>): CharacterValues {
  const out: CharacterValues = { ...values };
  for (const [id, v] of Object.entries(computed)) if (v !== null) out[id] = v;
  return out;
}
