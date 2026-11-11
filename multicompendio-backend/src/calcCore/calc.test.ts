import test from 'node:test';
import assert from 'node:assert/strict';
import { CalcAttr, CalcDef, CalcError, buildModel, calcRefs, dependentsOf, describeCalc, eligibleOperands, evaluateAll, findCycle, parseCalcDef, reaches, roundCalc, traceCalc, validateCalc } from './index';

const A = (id: string) => ({ k: 'attr' as const, id });
const N = (v: number) => ({ k: 'num' as const, v });
const num = (id: string, name = id): CalcAttr => ({ id, name, type: 'number' });
const calc = (id: string, def: CalcDef, name = id): CalcAttr => ({ id, name, type: 'calculated', calc: def });
const run = (def: CalcDef, values: Record<string, unknown> = {}, extra: CalcAttr[] = []) => evaluateAll([num('a'), num('b'), { id: 'p', name: 'p', type: 'boolean' }, ...extra, calc('x', def)], values).values.x;

test('operações e a ordem da esquerda para a direita', () => {
  assert.equal(run({ start: N(2), steps: [{ op: 'add', x: N(3) }, { op: 'mul', x: N(4) }] }), 20); // (2+3)*4
  assert.equal(run({ start: N(10), steps: [{ op: 'sub', x: N(10) }, { op: 'div', x: N(2) }, { op: 'floor' }] }), 0);
  assert.equal(run({ start: A('a'), steps: [{ op: 'sub', x: N(10) }, { op: 'div', x: N(2) }, { op: 'floor' }] }, { a: 16 }), 3);
  assert.equal(run({ start: A('a'), steps: [{ op: 'sub', x: N(10) }, { op: 'div', x: N(2) }, { op: 'floor' }] }, { a: 9 }), -1);
  assert.equal(run({ start: N(1), steps: [{ op: 'div', x: N(3) }] }), 0.33);
  assert.equal(run({ start: N(5), steps: [{ op: 'atleast', x: N(8) }] }), 8);
  assert.equal(run({ start: N(5), steps: [{ op: 'atmost', x: N(3) }] }), 3);
  assert.equal(run({ start: N(2.1), steps: [{ op: 'ceil' }] }), 3);
  assert.equal(run({ start: N(-2.5), steps: [{ op: 'round' }] }), -3);
  assert.equal(run({ start: N(2.5), steps: [{ op: 'round' }] }), 3);
  assert.equal(run({ start: N(0), steps: [{ op: 'mul', x: N(-1) }] }), 0); // sem -0
});

test('vazio contamina; divisão por zero vira vazio e é marcada', () => {
  assert.equal(run({ start: A('a'), steps: [{ op: 'add', x: N(1) }] }, {}), null);
  assert.equal(run({ start: N(1), steps: [{ op: 'add', x: A('b') }] }, { b: null }), null);
  assert.equal(run({ start: N(1), steps: [{ op: 'add', x: A('b') }, { op: 'floor' }] }, { b: '' }), null);
  const r = evaluateAll([num('b'), calc('x', { start: N(1), steps: [{ op: 'div', x: A('b') }] })], { b: 0 });
  assert.equal(r.values.x, null); assert.equal(r.div0.x, true);
  assert.equal(evaluateAll([num('b'), calc('x', { start: A('b'), steps: [{ op: 'div', x: N(0) }] })], { b: 4 }).div0.x, true);
  assert.equal(run({ start: N(4), steps: [{ op: 'div', x: A('b') }] }, { b: '2' }), 2); // número em texto numérico
});

test('passo condicional: desmarcado não soma nem exige o valor', () => {
  const def: CalcDef = { start: A('a'), steps: [{ op: 'addif', x: A('b'), cond: 'p' }] };
  assert.equal(run(def, { a: 5, p: false, b: null }), 5);
  assert.equal(run(def, { a: 5, b: null }), 5);
  assert.equal(run(def, { a: 5, p: true, b: null }), null);
  assert.equal(run(def, { a: 5, p: true, b: 3 }), 8);
  assert.equal(run(def, { a: null, p: false, b: 3 }), null);
});

test('calculado usando calculado, em qualquer ordem da lista', () => {
  const m = calc('m', buildModel('mod', ['a']));
  const s = calc('s', { start: A('m'), steps: [{ op: 'addif', x: A('b'), cond: 'p' }] });
  const attrs = [s, m, num('a'), num('b'), { id: 'p', name: 'p', type: 'boolean' }];
  assert.deepEqual(evaluateAll(attrs, { a: 16, b: 3, p: true }).values, { s: 6, m: 3 });
  assert.deepEqual(evaluateAll(attrs, { a: 16, b: 3, p: false }).values, { s: 3, m: 3 });
  assert.equal(evaluateAll(attrs, {}).values.m, null);
});

test('traceCalc mostra o resultado depois de cada passo', () => {
  const def = buildModel('mod', ['a']);
  assert.deepEqual(traceCalc(def, [num('a')], { a: 16 }).steps, [16, 6, 3, 3]);
  assert.deepEqual(traceCalc(def, [num('a')], {}).steps, [null, null, null, null]);
});

test('parseCalcDef confere e limpa a entrada', () => {
  assert.deepEqual(parseCalcDef({ start: A('a'), steps: [{ op: 'floor', x: N(1), extra: 1 }] }), { start: A('a'), steps: [{ op: 'floor' }] });
  assert.deepEqual(parseCalcDef({ start: N(1) }), { start: N(1), steps: [] });
  for (const bad of [null, 'x', {}, { start: { k: 'num', v: 'a' } }, { start: { k: 'num', v: Infinity } }, { start: { k: 'attr', id: '' } }, { start: N(1), steps: 'x' }, { start: N(1), steps: [{ op: 'pow', x: N(2) }] }, { start: N(1), steps: [{ op: 'add' }] }, { start: N(1), steps: [{ op: 'addif', x: N(1) }] }, { start: N(1), steps: new Array(31).fill({ op: 'floor' }) }]) {
    assert.throws(() => parseCalcDef(bad), CalcError, JSON.stringify(bad).slice(0, 60));
  }
});

test('validateCalc: atributos, tipos, divisão e círculos', () => {
  const attrs: CalcAttr[] = [num('a', 'Força'), { id: 't', name: 'Nome', type: 'text' }, { id: 'p', name: 'Prof', type: 'boolean' }, calc('m', { start: A('a'), steps: [] }, 'Mod'), calc('s', { start: A('m'), steps: [] }, 'Salv')];
  const self = { id: 'x', name: 'Novo' };
  assert.doesNotThrow(() => validateCalc({ start: A('a'), steps: [{ op: 'addif', x: N(2), cond: 'p' }] }, self, attrs));
  assert.throws(() => validateCalc({ start: A('zz'), steps: [] }, self, attrs), /não existe/);
  assert.throws(() => validateCalc({ start: A('t'), steps: [] }, self, attrs), /não é numérico/);
  assert.throws(() => validateCalc({ start: A('p'), steps: [] }, self, attrs), /não é numérico/);
  assert.throws(() => validateCalc({ start: N(1), steps: [{ op: 'addif', x: N(1), cond: 'a' }] }, self, attrs), /campo marcável/);
  assert.throws(() => validateCalc({ start: N(1), steps: [{ op: 'div', x: N(0) }] }, self, attrs), /dividir por zero/);
  assert.throws(() => validateCalc({ start: A('x'), steps: [] }, self, attrs), /a si mesmo/);
  assert.throws(() => validateCalc({ start: A('s'), steps: [] }, { id: 'm', name: 'Mod' }, attrs), /Mod → Salv → Mod/); // m usa s, que usa m
  assert.doesNotThrow(() => validateCalc({ start: A('a'), steps: [] }, { id: 'm', name: 'Mod' }, attrs)); // refazer a própria conta é ok
});

test('quem usa quem', () => {
  const attrs: CalcAttr[] = [num('a'), calc('m', { start: A('a'), steps: [] }), calc('s', { start: A('m'), steps: [{ op: 'addif', x: N(1), cond: 'p' }] }), { id: 'p', name: 'p', type: 'boolean' }];
  assert.deepEqual(calcRefs(attrs[2].calc!), ['m', 'p']);
  assert.deepEqual(dependentsOf('a', attrs).map((x) => x.id), ['m']);
  assert.deepEqual(dependentsOf('p', attrs).map((x) => x.id), ['s']);
  assert.equal(reaches('s', 'a', attrs), true); assert.equal(reaches('a', 's', attrs), false);
  assert.deepEqual(findCycle('a', ['s'], attrs), ['a', 's', 'm', 'a']);
  assert.equal(findCycle('s', ['a'], attrs), null);
  assert.deepEqual(eligibleOperands('m', attrs).map((o) => [o.id, o.blocked]), [['a', false], ['s', true]]);
});

test('frase em português e modelos', () => {
  const nm = (id: string) => ({ a: 'Força', b: 'Bônus', p: 'Proficiente' } as Record<string, string>)[id] ?? id;
  assert.equal(describeCalc(buildModel('mod', ['a']), nm), 'Começa com “Força”, subtrai 10, divide por 2 e arredonda para baixo.');
  assert.equal(describeCalc({ start: A('a'), steps: [{ op: 'addif', x: A('b'), cond: 'p' }] }, nm), 'Começa com “Força”, soma “Bônus” se “Proficiente” estiver marcado.');
  assert.equal(describeCalc(buildModel('copy', ['a']), nm), 'O valor é o mesmo de “Força”.');
  assert.equal(describeCalc({ start: N(1.5), steps: [{ op: 'mul', x: N(2) }] }, nm), 'Começa com 1,5, multiplica por 2.');
  assert.deepEqual(buildModel('sum', ['a', 'b']).steps, [{ op: 'add', x: A('b') }]);
  assert.deepEqual(buildModel('blank', []), { start: N(0), steps: [] });
  assert.equal(roundCalc(1 / 3), 0.33);
});

// gerador pseudoaleatório fixo, para o fuzz ser repetível
let seed = 20261110;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];

test('fuzz: contas aleatórias sem círculo sempre validam e calculam sem erro (400 casos)', () => {
  const OPS = ['add', 'sub', 'mul', 'div', 'atleast', 'atmost', 'addif', 'floor', 'ceil', 'round'] as const;
  for (let it = 0; it < 400; it++) {
    const attrs: CalcAttr[] = [num('n0'), num('n1'), num('n2'), { id: 'b0', name: 'b0', type: 'boolean' }];
    const total = 3 + Math.floor(rnd() * 5);
    for (let i = 0; i < total; i++) {
      const pool = attrs.filter((a) => a.type === 'number' || a.type === 'calculated').map((a) => a.id); // só os anteriores: sem círculo
      const opd = () => (rnd() < 0.5 ? A(pick(pool)) : N(pick([-3, -1, 0.5, 1, 2, 7, 10, 100])));
      const steps = Array.from({ length: Math.floor(rnd() * 6) }, () => {
        const op = pick([...OPS]);
        const s: { op: typeof op; x?: ReturnType<typeof opd>; cond?: string } = { op };
        if (op !== 'floor' && op !== 'ceil' && op !== 'round') s.x = op === 'div' && rnd() < 0.5 ? N(pick([2, 3, -4])) : opd();
        if (op === 'addif') s.cond = 'b0';
        return s;
      });
      const def: CalcDef = { start: opd(), steps };
      const id = `c${i}`;
      assert.doesNotThrow(() => validateCalc(parseCalcDef(def), { id, name: id }, attrs));
      attrs.push(calc(id, def));
    }
    const values: Record<string, unknown> = {};
    for (const k of ['n0', 'n1', 'n2']) if (rnd() < 0.8) values[k] = pick([0, 1, 8, 10, 16, 30, -2, 3.5]);
    values.b0 = rnd() < 0.5;
    const r1 = evaluateAll(attrs, values), r2 = evaluateAll([...attrs].reverse(), values);
    assert.deepEqual(r1.values, r2.values, 'a ordem da lista não muda o resultado');
    for (const v of Object.values(r1.values)) assert.ok(v === null || Number.isFinite(v));
  }
});

test('fuzz: qualquer círculo é apontado (200 casos)', () => {
  for (let it = 0; it < 200; it++) {
    const n = 3 + Math.floor(rnd() * 5);
    const attrs: CalcAttr[] = [num('base')];
    for (let i = 0; i < n; i++) attrs.push(calc(`c${i}`, { start: A(i === 0 ? 'base' : `c${i - 1}`), steps: [] })); // c_i usa c_{i-1}
    const k = Math.floor(rnd() * n);
    assert.throws(() => validateCalc({ start: A(`c${n - 1}`), steps: [] }, { id: `c${k}`, name: `c${k}` }, attrs), k === n - 1 ? /a si mesmo/ : /círculo/); // c_k passando a usar o último
    assert.doesNotThrow(() => validateCalc({ start: A('base'), steps: [] }, { id: `c${k}`, name: `c${k}` }, attrs));
  }
});
