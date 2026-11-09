import { useEffect, useState } from 'react';
import {
  AttrIndex, CW, MAX_BODY_H, MIN_SEC_H, MIN_SEC_W, SHAPE_KEYS, SHAPE_LABELS, SheetLayout, ShapeKey, allowedShapes, ceil1, deleteSection, findSection, itemsBounds,
  locate, minSize, moveSectionToPage, nextSectionId, placeItem, r1, resizeSectionFrame, sendToTray, setItemRect, setItemShape, setSectionRect, addSection,
} from '../../layoutCore';
import { LayoutAttribute } from '../../layoutCore';
import { Selection, TYPE_LABELS, fmt } from './common';
import { EditFnType } from './useLayoutEditor';
import { failMessage } from './engine';

const ICONS: Record<ShapeKey, string> = {
  rect: '<rect x="4" y="6" width="92" height="52"/>',
  rounded: '<rect x="4" y="6" width="92" height="52" rx="12"/>',
  pill: '<rect x="4" y="12" width="92" height="40" rx="20"/>',
  ellipse: '<ellipse cx="50" cy="32" rx="46" ry="26"/>',
  circle: '<circle cx="50" cy="32" r="27"/>',
  diamond: '<polygon points="50,3 96,32 50,61 4,32"/>',
  triangle: '<polygon points="50,4 96,60 4,60"/>',
  hexagon: '<polygon points="4,32 24,5 76,5 96,32 76,59 24,59"/>',
  shield: '<path d="M6,5 H94 V34 Q94,52 50,61 Q6,52 6,34 Z"/>',
};

// Campo numérico que só aplica o valor ao sair do campo ou ao apertar Enter (e volta ao valor real se for recusado).
function NumInput({ value, label, onCommit, nonce, min, max }: { value: number; label: string; onCommit: (v: number) => void; nonce: number; min?: number; max?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value, nonce]);
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (!Number.isFinite(v) || v === value) { setText(String(value)); return; }
    onCommit(v);
  };
  return (
    <input
      type="number" step={0.5} min={min} max={max} value={text} aria-label={label}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
    />
  );
}

interface Props {
  layout: SheetLayout; attrs: AttrIndex; selected: Selection | null; overIds: Set<string>; nonce: number;
  edit: EditFnType; select: (s: Selection | null) => void; canUndo: boolean; onUndo: () => void;
  onClose: () => void; onPlace: (id: string, sectionId?: string) => void;
}

export function Inspector(p: Props) {
  const { layout, attrs, selected, edit, select } = p;
  const close = (
    <>
      <button type="button" className="le-btn le-close-sheet" aria-label="Fechar opções" onClick={p.onClose}>Fechar</button>
      <button type="button" className="le-btn le-close-sheet" disabled={!p.canUndo} onClick={p.onUndo}>↶ Desfazer</button>
    </>
  );

  if (selected?.kind === 'field') {
    const a = attrs.get(selected.id);
    if (!a) return null;
    const l = locate(layout, a.id);
    if (!l) return <TrayField a={a} layout={layout} close={close} onPlace={p.onPlace} />;
    return <FieldPanel a={a} layout={layout} attrs={attrs} over={p.overIds.has(a.id)} nonce={p.nonce} edit={edit} close={close} />;
  }
  if (selected?.kind === 'sec') {
    const s = findSection(layout, selected.id);
    if (!s) return null;
    return <SectionPanel id={s.id} layout={layout} nonce={p.nonce} edit={edit} select={select} close={close} />;
  }
  return (
    <>
      <h2>Como usar</h2>
      <ul className="le-tips">
        <li>Clique num campo ou na faixa de uma seção para selecioná-lo. Arraste pelo ⠿ (ou pelo próprio campo, com o mouse).</li>
        <li>As <b>alças</b> mudam o tamanho: nos campos (quadradas) e nas seções (redondas, azuis), na horizontal, na vertical e na diagonal.</li>
        <li>Uma seção pode ir para <b>qualquer ponto de qualquer página</b>, inclusive ao lado de outra.</li>
        <li>Na <b>gaveta</b> ficam os campos fora da folha: arraste dela para a folha e de volta. Só o que está na folha sai no PDF.</li>
        <li>Escolha o <b>formato</b> do campo no painel (círculo, escudo, hexágono…).</li>
        <li>Guias verdes mostram alinhamentos; <kbd>Alt</kbd> desliga o ímã. Setas movem 1 mm (<kbd>Shift</kbd> 5 mm); <kbd>Alt</kbd>+setas mudam o tamanho; <kbd>Delete</kbd> guarda na gaveta.</li>
        <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz, <kbd>Ctrl</kbd>+<kbd>Y</kbd> refaz. Nada vale até clicar em <b>Salvar layout</b>.</li>
      </ul>
    </>
  );
}

function TrayField({ a, layout, close, onPlace }: { a: LayoutAttribute; layout: SheetLayout; close: JSX.Element; onPlace: (id: string, sectionId?: string) => void }) {
  const [sec, setSec] = useState(layout.sections[0]?.id ?? '');
  return (
    <>
      {close}
      <h2>{a.name}</h2>
      <span className="le-pill">{TYPE_LABELS[a.type]}</span>
      <p className="le-hint" style={{ marginTop: 8 }}>Este campo está na gaveta, fora da folha.</p>
      <h3>Colocar na seção</h3>
      <select aria-label="Seção de destino" value={sec} onChange={(e) => setSec(e.target.value)}>
        {layout.sections.map((s) => <option key={s.id} value={s.id}>{s.title} (p. {s.page})</option>)}
      </select>
      <div className="le-row" style={{ marginTop: 8 }}>
        <button type="button" className="le-btn le-primary" disabled={!sec} onClick={() => onPlace(a.id, sec)}>Colocar na ficha</button>
      </div>
    </>
  );
}

function FieldPanel({ a, layout, attrs, over, nonce, edit, close }: { a: LayoutAttribute; layout: SheetLayout; attrs: AttrIndex; over: boolean; nonce: number; edit: EditFnType; close: JSX.Element }) {
  const l = locate(layout, a.id);
  if (!l) return null;
  const { item, sec } = l;
  const [mw, mh] = minSize(a.type, item.shape);
  const rect = (label: string, patch: Partial<{ x: number; y: number; w: number; h: number }>, coalesce?: string) =>
    edit(label, (d) => setItemRect(d, attrs, a.id, patch), { coalesce, select: { kind: 'field', id: a.id }, fail: 'Esse valor deixaria o campo sobre outro campo ou além do que a seção pode crescer.' });
  const nudge = (dx: number, dy: number, shift: boolean) => rect(`${a.name} movido`, { x: item.x + dx * (shift ? 5 : 1), y: item.y + dy * (shift ? 5 : 1) }, `f:${a.id}`);
  const allowed = allowedShapes(a.type);
  return (
    <>
      {close}
      <h2>{a.name}</h2>
      <span className="le-pill">{TYPE_LABELS[a.type]}</span>
      {over && <p className="le-badmsg" role="alert">O exemplo de texto não cabe nesta caixa nem com a fonte no mínimo (7 pt). Aumente a caixa ou mude o formato.</p>}
      <h3>Formato</h3>
      <div className="le-shapes" role="group" aria-label="Formato do campo">
        {SHAPE_KEYS.map((k) => (
          <button
            key={k} type="button" data-shape={k} aria-pressed={item.shape === k} aria-label={SHAPE_LABELS[k]} disabled={!allowed.includes(k)}
            title={allowed.includes(k) ? undefined : `${SHAPE_LABELS[k]} não serve para ${TYPE_LABELS[a.type].toLowerCase()}: o texto não caberia.`}
            onClick={() => edit(`${a.name}: formato ${SHAPE_LABELS[k].toLowerCase()}`, (d) => setItemShape(d, attrs, a.id, k), { select: { kind: 'field', id: a.id }, fail: 'Esse formato não cabe aqui: o círculo precisaria de mais espaço livre.' })}
          >
            <svg viewBox="0 0 100 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[k] }} />
            {SHAPE_LABELS[k]}
          </button>
        ))}
      </div>
      {item.shape === 'circle' && <p className="le-hint" style={{ marginTop: 6 }}>No círculo, largura e altura andam juntas.</p>}
      <h3>Posição (mm, a partir do canto da seção)</h3>
      <div className="le-nums">
        <label>X<NumInput value={r1(item.x)} nonce={nonce} label="Posição X em milímetros" onCommit={(v) => rect(`${a.name}: x = ${fmt(v)} mm`, { x: v })} /></label>
        <label>Y<NumInput value={r1(item.y)} nonce={nonce} label="Posição Y em milímetros" onCommit={(v) => rect(`${a.name}: y = ${fmt(v)} mm`, { y: v })} /></label>
      </div>
      <h3>Tamanho (mm)</h3>
      <div className="le-nums">
        <label>Largura<NumInput value={r1(item.w)} min={mw} nonce={nonce} label="Largura em milímetros" onCommit={(v) => rect(`${a.name}: largura ${fmt(v)} mm`, { w: v })} /></label>
        <label>Altura<NumInput value={r1(item.h)} min={mh} nonce={nonce} label="Altura em milímetros" onCommit={(v) => rect(`${a.name}: altura ${fmt(v)} mm`, { h: v })} /></label>
      </div>
      <h3>Mover 1 mm (Shift: 5 mm)</h3>
      <div className="le-dpad">
        <button type="button" className="le-btn u" aria-label="Subir" onClick={(e) => nudge(0, -1, e.shiftKey)}>↑</button>
        <button type="button" className="le-btn l" aria-label="Para a esquerda" onClick={(e) => nudge(-1, 0, e.shiftKey)}>←</button>
        <button type="button" className="le-btn d" aria-label="Descer" onClick={(e) => nudge(0, 1, e.shiftKey)}>↓</button>
        <button type="button" className="le-btn r" aria-label="Para a direita" onClick={(e) => nudge(1, 0, e.shiftKey)}>→</button>
      </div>
      <h3>Atalhos</h3>
      <div className="le-row">
        <button type="button" className="le-btn" onClick={() => rect(`${a.name} encostado à esquerda`, { x: 0 })}>Encostar à esquerda</button>
        <button type="button" className="le-btn" onClick={() => rect(`${a.name} centralizado`, { x: r1((sec.w - item.w) / 2) })}>Centralizar</button>
        <button type="button" className="le-btn" disabled={item.shape === 'circle'} title={item.shape === 'circle' ? 'O círculo mantém largura e altura iguais.' : undefined} onClick={() => rect(`${a.name} com a largura da seção`, { x: 0, w: sec.w })}>Largura toda</button>
      </div>
      <h3>Seção</h3>
      <select
        aria-label="Mover para a seção" value={sec.id}
        onChange={(e) => edit(`${a.name} mudou de seção`, (d) => { const r = placeItem(d, attrs, a.id, e.target.value, item.x, item.y); return r.ok ? true : { fail: failMessage(r.note) }; }, { select: { kind: 'field', id: a.id } })}
      >
        {layout.sections.map((s) => <option key={s.id} value={s.id}>{s.title} (p. {s.page})</option>)}
      </select>
      <h3>Campo</h3>
      <div className="le-row">
        <button type="button" className="le-btn le-danger" onClick={() => edit(`${a.name} foi para a gaveta`, (d) => { sendToTray(d, a.id); }, { select: { kind: 'field', id: a.id }, toast: true, undoable: true })}>Guardar na gaveta</button>
      </div>
    </>
  );
}

function SectionPanel({ id, layout, nonce, edit, select, close }: { id: string; layout: SheetLayout; nonce: number; edit: EditFnType; select: (s: Selection | null) => void; close: JSX.Element }) {
  const s = findSection(layout, id);
  const [name, setName] = useState(s?.title ?? '');
  useEffect(() => setName(s?.title ?? ''), [s?.title, id]);
  if (!s) return null;
  const b = itemsBounds(s.items);
  const minW = Math.max(MIN_SEC_W, ceil1(b.r));
  const minH = Math.max(MIN_SEC_H, ceil1(b.b));
  const set = (label: string, patch: Partial<{ x: number; y: number; w: number; h: number }>, coalesce?: string) =>
    edit(label, (d) => setSectionRect(d, id, patch), { coalesce, select: { kind: 'sec', id }, fail: 'Esse valor deixaria a seção sobre outra seção ou fora da folha.' });
  const nudge = (dx: number, dy: number, shift: boolean) => set(`Seção “${s.title}” movida`, { x: s.x + dx * (shift ? 5 : 1), y: s.y + dy * (shift ? 5 : 1) }, `s:${id}`);
  return (
    <>
      {close}
      <h2>Seção</h2>
      <span className="le-pill">{s.items.length} {s.items.length === 1 ? 'campo' : 'campos'}</span>
      <h3>Nome da seção</h3>
      <input
        type="text" id="le-sec-name" maxLength={60} aria-label="Nome da seção" value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (e.target.value.trim()) edit('Seção renomeada', (d) => { const f = findSection(d, id); if (f) f.title = e.target.value.slice(0, 60); }, { coalesce: `n:${id}`, select: { kind: 'sec', id } });
        }}
        onBlur={() => setName(s.title)}
      />
      <h3>Posição (mm, a partir da margem da página)</h3>
      <div className="le-nums">
        <label>X<NumInput value={r1(s.x)} nonce={nonce} label="Posição X da seção em milímetros" onCommit={(v) => set(`Seção: x = ${fmt(v)} mm`, { x: v })} /></label>
        <label>Y<NumInput value={r1(s.y)} nonce={nonce} label="Posição Y da seção em milímetros" onCommit={(v) => set(`Seção: y = ${fmt(v)} mm`, { y: v })} /></label>
      </div>
      <h3>Tamanho do corpo (mm)</h3>
      <div className="le-nums">
        <label>Largura<NumInput value={r1(s.w)} min={minW} max={CW} nonce={nonce} label="Largura da seção em milímetros" onCommit={(v) => set(`Seção: largura ${fmt(v)} mm`, { w: v })} /></label>
        <label>Altura<NumInput value={r1(s.h)} min={minH} max={MAX_BODY_H} nonce={nonce} label="Altura da seção em milímetros" onCommit={(v) => set(`Seção: altura ${fmt(v)} mm`, { h: v })} /></label>
      </div>
      <p className="le-hint" style={{ marginTop: 6 }}>Mínimo {fmt(minW)} × {fmt(minH)} mm (até o campo mais distante). Máximo: a folha e as seções vizinhas. Pode sobrar espaço em branco, de propósito.</p>
      <div className="le-row">
        <button
          type="button" className="le-btn" disabled={!b.any}
          onClick={() => edit('Seção ajustada ao conteúdo', (d) => resizeSectionFrame(d, id, { x: s.x + b.l, y: s.y + b.t, w: Math.max(MIN_SEC_W, ceil1(b.r - b.l)), h: Math.max(MIN_SEC_H, ceil1(b.b - b.t)) }), { select: { kind: 'sec', id } })}
        >Ajustar ao conteúdo</button>
      </div>
      <h3>Mover 1 mm (Shift: 5 mm)</h3>
      <div className="le-dpad">
        <button type="button" className="le-btn u" aria-label="Subir" onClick={(e) => nudge(0, -1, e.shiftKey)}>↑</button>
        <button type="button" className="le-btn l" aria-label="Para a esquerda" onClick={(e) => nudge(-1, 0, e.shiftKey)}>←</button>
        <button type="button" className="le-btn d" aria-label="Descer" onClick={(e) => nudge(0, 1, e.shiftKey)}>↓</button>
        <button type="button" className="le-btn r" aria-label="Para a direita" onClick={(e) => nudge(1, 0, e.shiftKey)}>→</button>
      </div>
      <h3>Página</h3>
      <select
        aria-label="Página da seção" value={s.page}
        onChange={(e) => edit('Seção mudou de página', (d) => moveSectionToPage(d, id, Number(e.target.value)), { select: { kind: 'sec', id }, fail: 'Essa página não tem espaço livre para a seção.' })}
      >
        {Array.from({ length: layout.pages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Página {n}</option>)}
        <option value={layout.pages + 1}>+ Nova página</option>
      </select>
      <h3>Seção</h3>
      <div className="le-row">
        <button type="button" className="le-btn" onClick={() => edit('Seção criada', (d) => { addSection(d, id); }, { select: { kind: 'sec', id: nextSectionId(layout) } })}>+ Criar outra</button>
        <button type="button" className="le-btn le-danger" onClick={() => { edit(`Seção “${s.title}” removida`, (d) => { deleteSection(d, id); }, { toast: true, undoable: true }); select(null); }}>Remover</button>
      </div>
    </>
  );
}
