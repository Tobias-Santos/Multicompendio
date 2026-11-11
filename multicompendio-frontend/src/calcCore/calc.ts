import { CALC_OPS, CalcAttr, CalcDef, CalcError, CalcOp, CalcOperand, CalcStep, MAX_STEPS } from './types';

const NEEDS_X: Record<CalcOp, boolean> = { add: true, sub: true, mul: true, div: true, atleast: true, atmost: true, addif: true, floor: false, ceil: false, round: false };
export const needsOperand = (op: CalcOp): boolean => NEEDS_X[op];
export const isNumericType = (type: string): boolean => type === 'number' || type === 'calculated';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/* ---------- entrada: confere e limpa o que chega de fora ---------- */
function parseOperand(raw: unknown, where: string): CalcOperand {
  if (!isObj(raw)) throw new CalcError(`${where}: escolha um atributo ou digite um número.`);
  if (raw.k === 'attr') {
    if (typeof raw.id !== 'string' || !raw.id || raw.id.length > 100) throw new CalcError(`${where}: escolha um atributo.`);
    return { k: 'attr', id: raw.id };
  }
  if (raw.k === 'num') {
    const v = raw.v;
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e9) throw new CalcError(`${where}: digite um número válido.`);
    return { k: 'num', v };
  }
  throw new CalcError(`${where}: escolha um atributo ou digite um número.`);
}

export function parseCalcDef(raw: unknown): CalcDef {
  if (!isObj(raw)) throw new CalcError('Escolha como o atributo é calculado.');
  const start = parseOperand(raw.start, 'Começo');
  const list = raw.steps === undefined ? [] : raw.steps;
  if (!Array.isArray(list)) throw new CalcError('Os passos da conta são inválidos.');
  if (list.length > MAX_STEPS) throw new CalcError(`A conta pode ter no máximo ${MAX_STEPS} passos.`);
  const steps = list.map((s: unknown, i: number): CalcStep => {
    const where = `Passo ${i + 1}`;
    if (!isObj(s) || typeof s.op !== 'string' || !(CALC_OPS as readonly string[]).includes(s.op)) throw new CalcError(`${where}: operação desconhecida.`);
    const op = s.op as CalcOp;
    const step: CalcStep = { op };
    if (NEEDS_X[op]) step.x = parseOperand(s.x, where);
    if (op === 'addif') {
      if (typeof s.cond !== 'string' || !s.cond || s.cond.length > 100) throw new CalcError(`${where}: escolha o campo marcável da condição.`);
      step.cond = s.cond;
    }
    return step;
  });
  return { start, steps };
}

/* ---------- quem usa quem ---------- */
export function calcRefs(def: CalcDef): string[] {
  const out: string[] = [];
  const add = (id: string) => { if (!out.includes(id)) out.push(id); };
  if (def.start.k === 'attr') add(def.start.id);
  for (const s of def.steps) { if (s.x && s.x.k === 'attr') add(s.x.id); if (s.cond) add(s.cond); }
  return out;
}
const depsOf = (attrs: CalcAttr[], id: string, selfId?: string, selfRefs?: string[]): string[] => {
  if (selfRefs && id === selfId) return selfRefs;
  const a = attrs.find((x) => x.id === id);
  return a && a.calc ? calcRefs(a.calc) : [];
};
export const dependentsOf = (id: string, attrs: CalcAttr[]): CalcAttr[] => attrs.filter((a) => a.calc && calcRefs(a.calc).includes(id));

// `from` depende, direta ou indiretamente, de `target`?
export function reaches(from: string, target: string, attrs: CalcAttr[], seen: Set<string> = new Set()): boolean {
  if (from === target) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return depsOf(attrs, from).some((d) => reaches(d, target, attrs, seen));
}

// Se `selfId` passasse a usar `newRefs`, haveria um círculo? Devolve o caminho (ids) ou null.
export function findCycle(selfId: string, newRefs: string[], attrs: CalcAttr[]): string[] | null {
  const path: string[] = [];
  const seen = new Set<string>([selfId]);
  const dfs = (id: string): boolean => {
    path.push(id);
    for (const d of depsOf(attrs, id, selfId, newRefs)) {
      if (d === selfId) { path.push(selfId); return true; }
      if (!seen.has(d)) { seen.add(d); if (dfs(d)) return true; }
    }
    path.pop();
    return false;
  };
  return dfs(selfId) ? path : null;
}

// Quais atributos o construtor pode oferecer como valor: os numéricos, menos o próprio; os que
// dependem dele vêm marcados como bloqueados (escolhê-los criaria um círculo).
export function eligibleOperands(selfId: string, attrs: CalcAttr[]): Array<{ id: string; name: string; blocked: boolean }> {
  return attrs.filter((a) => isNumericType(a.type) && a.id !== selfId).map((a) => ({ id: a.id, name: a.name, blocked: reaches(a.id, selfId, attrs) }));
}

export function validateCalc(def: CalcDef, self: { id: string; name: string }, attrs: CalcAttr[]): void {
  const map = new Map(attrs.map((a) => [a.id, a]));
  const checkOperand = (o: CalcOperand | undefined, where: string) => {
    if (!o) throw new CalcError(`${where}: escolha um atributo ou digite um número.`);
    if (o.k !== 'attr') return;
    if (o.id === self.id) throw new CalcError('Um atributo calculado não pode usar a si mesmo.');
    const a = map.get(o.id);
    if (!a) throw new CalcError(`${where}: o atributo escolhido não existe neste sistema.`);
    if (!isNumericType(a.type)) throw new CalcError(`${where}: "${a.name}" não é numérico.`);
  };
  checkOperand(def.start, 'Começo');
  def.steps.forEach((s, i) => {
    const w = `Passo ${i + 1}`;
    if (needsOperand(s.op)) checkOperand(s.x, w);
    if (s.op === 'div' && s.x && s.x.k === 'num' && s.x.v === 0) throw new CalcError(`${w}: não dá para dividir por zero.`);
    if (s.op === 'addif') {
      if (s.cond === self.id) throw new CalcError('Um atributo calculado não pode usar a si mesmo.');
      const c = map.get(s.cond ?? '');
      if (!c || c.type !== 'boolean') throw new CalcError(`${w}: escolha o campo marcável da condição.`);
    }
  });
  const cyc = findCycle(self.id, calcRefs(def), attrs);
  if (cyc) {
    const nm = (id: string) => (id === self.id ? self.name : map.get(id)?.name ?? '?');
    throw new CalcError(`Dependência em círculo: ${cyc.map(nm).join(' → ')}. Um atributo não pode depender, direta ou indiretamente, dele mesmo.`);
  }
}

/* ---------- cálculo ---------- */
export const roundCalc = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100 || 0);
export const formatCalcNumber = (v: number): string => String(v).replace('.', ',');

type Getter = (id: string) => number | null;

// Aplica os passos. acc[0] é o valor do começo; acc[i] é o valor depois do passo i. Vazio (null) contamina
// o resto; dividir por zero também (e fica marcado em div0).
export function runSteps(def: CalcDef, get: Getter): { acc: Array<number | null>; div0: boolean } {
  const val = (o: CalcOperand | undefined): number | null => (!o ? null : o.k === 'num' ? o.v : get(o.id));
  let cur = val(def.start);
  let div0 = false;
  const acc: Array<number | null> = [cur];
  for (const s of def.steps) {
    if (cur !== null) {
      switch (s.op) {
        case 'add': case 'sub': case 'mul': case 'atleast': case 'atmost': {
          const x = val(s.x);
          cur = x === null ? null : s.op === 'add' ? cur + x : s.op === 'sub' ? cur - x : s.op === 'mul' ? cur * x : s.op === 'atleast' ? Math.max(cur, x) : Math.min(cur, x);
          break;
        }
        case 'div': {
          const x = val(s.x);
          if (x === 0) { div0 = true; cur = null; } else cur = x === null ? null : cur / x;
          break;
        }
        case 'addif': {
          // campo desmarcado: não soma nada (e o valor da soma nem é exigido)
          if (get(s.cond ?? '') !== 0) { const x = val(s.x); cur = x === null ? null : cur + x; }
          break;
        }
        case 'floor': cur = Math.floor(cur); break;
        case 'ceil': cur = Math.ceil(cur); break;
        case 'round': cur = Math.sign(cur) * Math.round(Math.abs(cur)); break;
      }
    }
    acc.push(cur);
  }
  return { acc, div0 };
}

function makeGetter(attrs: CalcAttr[], values: Record<string, unknown>) {
  const map = new Map(attrs.map((a) => [a.id, a]));
  const memo: Record<string, number | null> = {};
  const div0: Record<string, true> = {};
  const visiting = new Set<string>();
  const get: Getter = (id) => {
    const a = map.get(id);
    if (!a) return null;
    if (a.type === 'number') {
      const v = values[id];
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (typeof v === 'string' && v.trim() !== '') { const n = Number(v); return Number.isFinite(n) ? n : null; }
      return null;
    }
    if (a.type === 'boolean') return values[id] === true ? 1 : 0;
    if (a.type !== 'calculated' || !a.calc) return null;
    if (id in memo) return memo[id];
    if (visiting.has(id)) return null; // proteção: um círculo nunca deveria existir
    visiting.add(id);
    const r = runSteps(a.calc, get);
    const v = roundCalc(r.acc[r.acc.length - 1]);
    if (r.div0 && v === null) div0[id] = true;
    visiting.delete(id);
    memo[id] = v;
    return v;
  };
  return { get, memo, div0 };
}

export interface CalcResult { values: Record<string, number | null>; div0: Record<string, true> }

// Calcula todos os atributos calculados de um personagem. `values`: id do atributo → valor digitado.
export function evaluateAll(attrs: CalcAttr[], values: Record<string, unknown>): CalcResult {
  const g = makeGetter(attrs, values);
  for (const a of attrs) if (a.type === 'calculated' && a.calc) g.get(a.id);
  const out: Record<string, number | null> = {};
  for (const a of attrs) if (a.type === 'calculated') out[a.id] = a.id in g.memo ? g.memo[a.id] : null;
  return { values: out, div0: g.div0 };
}

// Resultado depois de cada passo (para mostrar a conta sendo feita). `attrs` já deve trazer o rascunho no lugar do atributo.
export function traceCalc(def: CalcDef, attrs: CalcAttr[], values: Record<string, unknown>): { steps: Array<number | null>; div0: boolean } {
  const g = makeGetter(attrs, values);
  const r = runSteps(def, g.get);
  return { steps: r.acc.map(roundCalc), div0: r.div0 };
}

/* ---------- texto e modelos ---------- */
export function describeCalc(def: CalcDef, nameOf: (id: string) => string): string {
  const O = (o: CalcOperand | undefined) => (!o ? '…' : o.k === 'attr' ? `“${nameOf(o.id)}”` : formatCalcNumber(o.v));
  const P = (s: CalcStep): string => {
    switch (s.op) {
      case 'add': return `soma ${O(s.x)}`;
      case 'sub': return `subtrai ${O(s.x)}`;
      case 'mul': return `multiplica por ${O(s.x)}`;
      case 'div': return `divide por ${O(s.x)}`;
      case 'atleast': return `usa no mínimo ${O(s.x)}`;
      case 'atmost': return `usa no máximo ${O(s.x)}`;
      case 'addif': return `soma ${O(s.x)} se “${s.cond ? nameOf(s.cond) : '…'}” estiver marcado`;
      case 'floor': return 'arredonda para baixo';
      case 'ceil': return 'arredonda para cima';
      case 'round': return 'arredonda para o inteiro mais próximo';
    }
  };
  const parts = def.steps.map(P);
  if (!parts.length) return `O valor é o mesmo de ${O(def.start)}.`;
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  return `Começa com ${O(def.start)}, ${joined}.`;
}

export type CalcModel = 'mod' | 'sum' | 'copy' | 'blank';
// Monta a conta de um modelo pronto; `ids` são atributos numéricos para preencher os valores (o usuário troca depois).
export function buildModel(kind: CalcModel, ids: string[]): CalcDef {
  const at = (id: string | undefined): CalcOperand => (id ? { k: 'attr', id } : { k: 'num', v: 0 });
  const A = ids[0], B = ids[1] ?? ids[0];
  if (kind === 'mod') return { start: at(A), steps: [{ op: 'sub', x: { k: 'num', v: 10 } }, { op: 'div', x: { k: 'num', v: 2 } }, { op: 'floor' }] };
  if (kind === 'sum') return { start: at(A), steps: [{ op: 'add', x: at(B) }] };
  if (kind === 'copy') return { start: at(A), steps: [] };
  return { start: { k: 'num', v: 0 }, steps: [] };
}
