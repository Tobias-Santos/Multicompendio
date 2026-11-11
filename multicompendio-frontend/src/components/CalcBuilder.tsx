import { useMemo, useState } from 'react';
import {
  CalcAttr, CalcDef, CalcError, CalcModel, CalcOp, CalcOperand, buildModel, calcRefs, describeCalc, eligibleOperands,
  formatCalcNumber, needsOperand, traceCalc, validateCalc,
} from '../calcCore';
import { SystemAttribute } from '../types/system';

export const toCalcAttrs = (list: SystemAttribute[]): CalcAttr[] =>
  list.map((a) => ({ id: a.id, name: a.name, type: a.data_type, calc: a.calc ?? null }));

// O que impede de salvar a conta (ou null se está tudo certo). O servidor confere de novo.
export function calcProblem(def: CalcDef | null, attributes: SystemAttribute[], self: { id: string; name: string }): string | null {
  if (!def) return 'Escolha como o atributo é calculado.';
  const bad = (o?: CalcOperand) => !!o && o.k === 'num' && !Number.isFinite(o.v);
  if (bad(def.start)) return 'Começo: digite um número.';
  const i = def.steps.findIndex((s) => bad(s.x));
  if (i >= 0) return `Passo ${i + 1}: digite um número.`;
  try {
    validateCalc(def, self, toCalcAttrs(attributes.filter((a) => a.id !== self.id)));
    return null;
  } catch (e) {
    if (e instanceof CalcError) return e.message;
    throw e;
  }
}

const OPS: Array<[CalcOp, string]> = [
  ['add', 'Somar'], ['sub', 'Subtrair'], ['mul', 'Multiplicar por'], ['div', 'Dividir por'], ['atleast', 'No mínimo'], ['atmost', 'No máximo'],
  ['addif', 'Somar condicional'], ['floor', 'Arredondar para baixo'], ['ceil', 'Arredondar para cima'], ['round', 'Arredondar para o mais próximo'],
];
const MODELS: Array<{ k: CalcModel; t: string; d: string }> = [
  { k: 'mod', t: 'Modificador de atributo', d: 'Como no D&D: tira 10, divide por 2 e arredonda para baixo.' },
  { k: 'sum', t: 'Soma de atributos', d: 'Soma o valor de dois atributos.' },
  { k: 'copy', t: 'Cópia de outro atributo', d: 'Mostra o mesmo valor de outro atributo.' },
  { k: 'blank', t: 'Começar do zero', d: 'Monte a conta passo a passo.' },
];

function initialTest(attributes: SystemAttribute[]): Record<string, number | boolean> {
  const t: Record<string, number | boolean> = {};
  for (const a of attributes) {
    if (a.data_type === 'boolean') t[a.id] = false;
    else if (a.data_type === 'number') {
      const lo = a.min_value == null ? -Infinity : Number(a.min_value), hi = a.max_value == null ? Infinity : Number(a.max_value);
      t[a.id] = Math.min(hi, Math.max(lo, 10));
    }
  }
  return t;
}

function NumInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return <input type="number" step="any" className="calc-num" aria-label={label} value={Number.isFinite(value) ? String(value) : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />;
}

interface Props {
  value: CalcDef | null;
  onChange: (def: CalcDef | null) => void;
  attributes: SystemAttribute[]; // todos os atributos do sistema
  selfId: string;
  selfName: string;
}

// O construtor da conta de um atributo calculado: passos escolhidos em listas, a frase em português,
// o resultado de cada passo e modelos prontos. Sem digitar fórmula.
export function CalcBuilder({ value, onChange, attributes, selfId, selfName }: Props) {
  const others = useMemo(() => toCalcAttrs(attributes.filter((a) => a.id !== selfId)), [attributes, selfId]);
  const work = useMemo<CalcAttr[]>(() => [...others, { id: selfId, name: selfName || 'Este atributo', type: 'calculated', calc: value }], [others, selfId, selfName, value]);
  const options = useMemo(() => eligibleOperands(selfId, work), [work, selfId]);
  const bools = attributes.filter((a) => a.data_type === 'boolean');
  const nameOf = (id: string) => attributes.find((a) => a.id === id)?.name ?? '?';
  const [test, setTest] = useState<Record<string, number | boolean>>(() => initialTest(attributes));

  const problem = calcProblem(value, attributes, { id: selfId, name: selfName });
  const trace = useMemo(() => {
    if (!value || problem) return null;
    const vals: Record<string, unknown> = {};
    for (const a of attributes) { const t = test[a.id]; if (t !== undefined && t !== null && !(typeof t === 'number' && Number.isNaN(t))) vals[a.id] = t; }
    return traceCalc(value, work, vals);
  }, [value, problem, work, test, attributes]);

  const leaves = useMemo(() => {
    const out: string[] = []; const seen = new Set<string>(); const map = new Map(work.map((a) => [a.id, a]));
    const visit = (ids: string[]) => ids.forEach((id) => {
      if (seen.has(id)) return; seen.add(id);
      const a = map.get(id); if (!a) return;
      if (a.type === 'calculated') { if (a.calc) visit(calcRefs(a.calc)); } else if (a.type === 'number' || a.type === 'boolean') out.push(id);
    });
    if (value) visit(calcRefs(value));
    return out;
  }, [work, value]);

  if (!value) {
    return (
      <div className="calc-builder">
        <p className="calc-lead">Como você quer calcular?</p>
        <div className="calc-models">
          {MODELS.map((m) => (
            <button type="button" key={m.k} className="calc-model" data-model={m.k} onClick={() => onChange(buildModel(m.k, options.filter((o) => !o.blocked).map((o) => o.id)))}>
              <b>{m.t}</b><span>{m.d}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const setStep = (i: number, step: CalcDef['steps'][number]) => onChange({ ...value, steps: value.steps.map((s, j) => (j === i ? step : s)) });
  const changeOp = (i: number, op: CalcOp) => {
    const old = value.steps[i];
    const s: CalcDef['steps'][number] = { op };
    if (needsOperand(op)) s.x = old.x ?? { k: 'num', v: op === 'div' || op === 'mul' ? 1 : 0 };
    if (op === 'addif') s.cond = old.cond ?? bools[0]?.id ?? '';
    setStep(i, s);
  };
  const move = (i: number, d: -1 | 1) => { const st = value.steps.slice(); [st[i], st[i + d]] = [st[i + d], st[i]]; onChange({ ...value, steps: st }); };
  const run = (k: number, last: boolean) => {
    if (!trace) return '';
    const v = trace.steps[k];
    return v === null || v === undefined ? (last && trace.div0 ? 'divisão por zero' : '—') : formatCalcNumber(v);
  };

  const picker = (o: CalcOperand, change: (o: CalcOperand) => void, label: string) => {
    const known = o.k === 'attr' && options.some((x) => x.id === o.id);
    return (
      <>
        <select className="calc-sel-opd" aria-label={label} value={o.k === 'attr' ? o.id : '__num'} onChange={(e) => change(e.target.value === '__num' ? { k: 'num', v: 0 } : { k: 'attr', id: e.target.value })}>
          <optgroup label="Atributos">
            {o.k === 'attr' && !known && <option value={o.id}>{nameOf(o.id)} (indisponível)</option>}
            {options.map((x) => <option key={x.id} value={x.id} disabled={x.blocked}>{x.name}{x.blocked ? ' (usa este atributo)' : ''}</option>)}
          </optgroup>
          <option value="__num">um número</option>
        </select>
        {o.k === 'num' && <NumInput value={o.v} label={`${label}: número`} onChange={(v) => change({ k: 'num', v })} />}
      </>
    );
  };

  const last = value.steps.length;
  return (
    <div className="calc-builder">
      <p className="calc-sentence" aria-live="polite">{describeCalc(value, nameOf)}</p>
      <div className="calc-steps">
        <div className="calc-step">
          <div className="calc-sl">Começar com</div>
          <div className="calc-sc">{picker(value.start, (o) => onChange({ ...value, start: o }), 'Começo')}</div>
          <div className="calc-run" data-run="-1">{run(0, last === 0)}</div>
          <div className="calc-ctl" />
        </div>
        {value.steps.map((s, i) => (
          <div className="calc-step" key={i}>
            <div className="calc-sl">
              <select className="calc-sel-op" aria-label={`Operação do passo ${i + 1}`} value={s.op} onChange={(e) => changeOp(i, e.target.value as CalcOp)}>
                {OPS.map(([k, label]) => <option key={k} value={k} disabled={k === 'addif' && bools.length === 0}>{label}</option>)}
              </select>
            </div>
            <div className="calc-sc">
              {needsOperand(s.op) && s.x && picker(s.x, (o) => setStep(i, { ...s, x: o }), `Valor do passo ${i + 1}`)}
              {s.op === 'addif' && (
                <>
                  <span className="calc-mid">se</span>
                  <select className="calc-sel-cond" aria-label={`Campo da condição do passo ${i + 1}`} value={s.cond ?? ''} onChange={(e) => setStep(i, { ...s, cond: e.target.value })}>
                    {bools.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <span className="calc-mid">estiver marcado</span>
                </>
              )}
            </div>
            <div className="calc-run" data-run={i}>{run(i + 1, i + 1 === last)}</div>
            <div className="calc-ctl">
              <button type="button" className="calc-ibtn" data-mv="up" aria-label={`Mover o passo ${i + 1} para cima`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="calc-ibtn" data-mv="down" aria-label={`Mover o passo ${i + 1} para baixo`} disabled={i === last - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="calc-ibtn" data-mv="rm" aria-label={`Remover o passo ${i + 1}`} onClick={() => onChange({ ...value, steps: value.steps.filter((_, j) => j !== i) })}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="calc-below">
        <button type="button" className="calc-link calc-add" onClick={() => onChange({ ...value, steps: [...value.steps, { op: 'add', x: { k: 'num', v: 1 } }] })}>+ Adicionar passo</button>
        <details className="calc-more">
          <summary>Mais opções</summary>
          <button type="button" className="calc-link calc-other-model" onClick={() => onChange(null)}>Começar de outro modelo</button>
        </details>
      </div>
      {problem && <p className="calc-error" role="alert">{problem}</p>}
      <details className="calc-tests">
        <summary>Valores de teste</summary>
        {leaves.length === 0 && <p className="calc-note">Esta conta não usa outros atributos.</p>}
        {leaves.map((id) => {
          const a = attributes.find((x) => x.id === id); if (!a) return null;
          return a.data_type === 'boolean' ? (
            <label key={id} className="calc-tv"><span>{a.name}</span><input type="checkbox" checked={test[id] === true} onChange={(e) => setTest({ ...test, [id]: e.target.checked })} /></label>
          ) : (
            <label key={id} className="calc-tv"><span>{a.name}</span><input type="number" step="any" value={typeof test[id] === 'number' && Number.isFinite(test[id] as number) ? String(test[id]) : ''} onChange={(e) => setTest({ ...test, [id]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
          );
        })}
      </details>
    </div>
  );
}
