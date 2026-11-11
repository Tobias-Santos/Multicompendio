import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LayoutAttribute, addPage, addSection, autoLayout, deleteSection, findSection, indexAttrs, nextSectionId, placeItem, removePage,
} from '../layoutCore';
import { ApiError } from '../api/http';
import { LayoutView, getLayout, saveLayout } from '../api/layoutApi';
import { getSystem } from '../api/systemsApi';
import { RpgSystem, SystemAttribute } from '../types/system';
import { Drawer } from '../components/layout/Drawer';
import { Inspector } from '../components/layout/Inspector';
import { SheetStage } from '../components/layout/SheetStage';
import { EngineCtx, createEngine, failMessage, handleKey } from '../components/layout/engine';
import { cx, vars } from '../components/layout/common';
import { useLayoutEditor } from '../components/layout/useLayoutEditor';
import '../layoutEditor.css';

const MIN_FIT = 7 / 9.2;

const toLayoutAttr = (a: SystemAttribute): LayoutAttribute => ({ id: a.id, name: a.name, type: a.data_type === 'calculated' ? 'number' : a.data_type, group: a.group_name, order: a.display_order });

// Mede cada campo com o texto de exemplo: a fonte encolhe até 7 pt; se mesmo assim não couber, o campo é marcado.
function fitCards(root: HTMLElement): Set<string> {
  const over = new Set<string>();
  root.querySelectorAll<HTMLElement>('.le-card[data-field]').forEach((card) => {
    const c = card.querySelector<HTMLElement>('.le-c');
    if (!c) return;
    // com o conteúdo centralizado, o excesso se divide entre cima e baixo e o scrollHeight só conta o de baixo: mede com o alinhamento no topo
    const keep = { j: c.style.justifyContent, a: c.style.alignItems };
    c.style.justifyContent = 'flex-start';
    c.style.alignItems = 'flex-start';
    const tooBig = () => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1 || Array.from(c.querySelectorAll<HTMLElement>('.le-area')).some((a) => a.scrollHeight > a.clientHeight + 1);
    let fit = 1;
    c.style.setProperty('--fit', '1');
    while (tooBig() && fit > MIN_FIT + 0.001) {
      fit = Math.max(MIN_FIT, fit - 0.04);
      c.style.setProperty('--fit', fit.toFixed(2));
    }
    if (tooBig()) over.add(card.dataset.field as string);
    c.style.justifyContent = keep.j;
    c.style.alignItems = keep.a;
  });
  return over;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

export function LayoutEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ system: RpgSystem; attributes: SystemAttribute[]; view: LayoutView } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setData(null);
    Promise.all([getSystem(id), getLayout(id)])
      .then(([s, view]) => setData({ system: s.system, attributes: s.attributes, view }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível abrir o layout da ficha.'));
  }, [id]);

  if (error) {
    return (
      <div className="layout">
        <p className="error">{error}</p>
        <Link to={id ? `/sistemas/${id}` : '/'}>← voltar</Link>
      </div>
    );
  }
  if (!data || !id) {
    return (
      <div className="layout">
        <p className="muted">Carregando...</p>
      </div>
    );
  }
  if (!data.system.can_edit) {
    return (
      <div className="layout">
        <h1>{data.system.name}</h1>
        <p className="muted">Só quem criou o sistema pode organizar a ficha dele. O sistema que já vem com o aplicativo também não pode ser alterado.</p>
        <Link to={`/sistemas/${id}`}>← voltar ao sistema</Link>
      </div>
    );
  }
  return <Editor key={id} system={data.system} attributes={data.attributes} initial={data.view} />;
}

function Editor({ system, attributes, initial }: { system: RpgSystem; attributes: SystemAttribute[]; initial: LayoutView }) {
  const attrsList = useMemo(() => attributes.map(toLayoutAttr), [attributes]);
  const attrs = useMemo(() => indexAttrs(attrsList), [attrsList]);
  const ed = useLayoutEditor(initial.layout);
  const { state, dirty } = ed;
  const [version, setVersion] = useState(initial.version);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [zoom, setZoom] = useState(1);
  const [mm, setMm] = useState(4);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [overIds, setOverIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const editable = mode === 'edit';

  // ---- o tamanho de 1 mm na tela: a folha ocupa a largura disponível (nunca menos de 3 px por mm), vezes o zoom
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const measure = () => setMm(Math.max(3, Math.max(200, wrap.clientWidth - 6) / 210) * zoom);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [zoom]);

  // ---- o motor de arrasto lê sempre o estado mais recente por esta referência
  const latest = useRef({ layout: state.layout, attrs, mm, editable, edit: ed.edit, select: ed.select });
  latest.current = { layout: state.layout, attrs, mm, editable, edit: ed.edit, select: ed.select };
  const engine = useMemo(() => createEngine((): EngineCtx => ({ root: rootRef.current as HTMLElement, ...latest.current, openDrawer: setDrawerOpen })), []);
  useEffect(() => () => engine.cancel(), [engine]);

  // ---- campos que não cabem na caixa (com o texto de exemplo)
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = editable ? fitCards(root) : new Set<string>();
    setOverIds((prev) => (sameSet(prev, next) ? prev : next));
  }, [state.layout, mm, editable]);

  const placedIds = useMemo(() => new Set(state.layout.sections.flatMap((s) => s.items.map((i) => i.attributeId))), [state.layout]);
  const tray = useMemo(() => attrsList.filter((a) => !placedIds.has(a.id)).sort((a, b) => a.order - b.order), [attrsList, placedIds]);
  const selected = state.selected;
  const hasSel = !!selected && editable;

  // ---- aviso na tela some sozinho
  const msg = state.message;
  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => ed.dismiss(), msg.undoable ? 6500 : 3200);
    return () => clearTimeout(t);
  }, [msg, ed]);

  // ---- alterações não salvas: avisa ao fechar a aba
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ---- no celular, o campo selecionado rola para ficar acima da gaveta de opções
  useEffect(() => {
    if (selected?.kind !== 'field' || !window.matchMedia('(max-width: 979px)').matches) return;
    rootRef.current?.querySelector<HTMLElement>(`.le-card[data-field="${selected.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  // ---- ações
  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const out = await saveLayout(system.id, state.layout, version);
      setVersion(out.version);
      if (JSON.stringify(out.layout) === JSON.stringify(state.layout)) ed.markSaved(out.layout);
      else ed.load(out.layout, true); // o servidor descartou algo (atributo apagado): usa a versão dele
      ed.say(out.dropped ? `Layout salvo. ${out.dropped} campo(s) de atributos que não existem mais foram descartados.` : 'Layout salvo.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar o layout.');
    } finally {
      setSaving(false);
    }
  }, [system.id, state.layout, version, ed]);

  async function reloadFromServer() {
    try {
      const view = await getLayout(system.id);
      setVersion(view.version);
      ed.load(view.layout, true);
      setConflict(false);
      ed.say('Layout recarregado da versão mais recente.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível recarregar.');
    }
  }

  const addNear = useCallback((near?: string) => {
    const ref = near ?? (selected?.kind === 'sec' ? selected.id : undefined);
    const nid = nextSectionId(state.layout);
    ed.edit('Seção criada', (d) => { addSection(d, ref); }, { select: { kind: 'sec', id: nid } });
    setTimeout(() => { const i = document.getElementById('le-sec-name') as HTMLInputElement | null; if (i) { i.focus(); i.select(); } }, 60);
  }, [ed, selected, state.layout]);

  const removeSection = useCallback((secId: string) => {
    const s = findSection(state.layout, secId);
    ed.edit(`Seção “${s?.title ?? ''}” removida`, (d) => { deleteSection(d, secId); }, { select: null, toast: true, undoable: true });
  }, [ed, state.layout]);

  // "Colocar na ficha": tenta a seção escolhida (ou a selecionada), depois a do mesmo grupo do campo e, por fim, as outras (da última para a primeira),
  // e fica com a primeira em que houver espaço.
  const place = useCallback((attrId: string, secId?: string) => {
    const attr = attrs.get(attrId);
    const sections = state.layout.sections;
    if (!sections.length) { ed.say('Crie uma seção primeiro.'); return; }
    const first = secId ?? (selected?.kind === 'sec' ? selected.id : undefined);
    const sameGroup = sections.filter((x) => x.title === attr?.group || x.title.startsWith(`${attr?.group ?? '\u0000'} (`)).map((x) => x.id);
    const order = [...new Set([...(first ? [first] : []), ...sameGroup, ...[...sections].reverse().map((x) => x.id)])];
    ed.edit(`${attr?.name ?? 'Campo'} entrou na ficha`, (d) => {
      let note = 'full';
      for (const target of order) {
        const r = placeItem(d, attrs, attrId, target, 0, 0);
        if (r.ok) return true;
        if (r.note === 'nogrow') note = 'nogrow';
      }
      return { fail: `${failMessage(note).replace(' O campo voltou ao lugar.', '')} Aumente uma seção ou crie outra.` };
    }, { select: { kind: 'field', id: attrId } });
    setDrawerOpen(false);
  }, [ed, attrs, selected, state.layout.sections]);

  function remakeAutomatic() {
    ed.edit('Layout automático aplicado', (d) => {
      const a = autoLayout(attrsList);
      d.pages = a.pages;
      d.sections = a.sections;
      d.memo = {};
    }, { select: null, toast: true, undoable: true });
  }

  // ---- teclado: atalhos gerais
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches?.('input, textarea, select');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); return; }
      if (typing) return;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); ed.undo(); return; }
      if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); ed.redo(); return; }
      if (e.key === 'Escape') { if (engine.isDragging()) engine.cancel(); else if (drawerOpen) setDrawerOpen(false); else if (state.selected) ed.select(null); }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [ed, engine, save, drawerOpen, state.selected]);

  function onClick(e: ReactMouseEvent) {
    if (engine.consumeClickGuard() || !editable) return;
    const t = e.target as HTMLElement;
    if (t.closest('.le-hd, button, input, select, a')) return;
    const card = t.closest<HTMLElement>('.le-card[data-field], .le-dchip[data-field]');
    if (card) { ed.select({ kind: 'field', id: card.dataset.field as string }); return; }
    const bar = t.closest<HTMLElement>('.le-sec-bar');
    if (bar) { ed.select({ kind: 'sec', id: (bar.closest('.le-sec') as HTMLElement).dataset.sec as string }); return; }
    const body = t.closest<HTMLElement>('.le-sec-body');
    if (body) { ed.select({ kind: 'sec', id: body.dataset.body as string }); return; }
    if (t.closest('.le-pages') && state.selected) ed.select(null);
  }

  const warnCount = overIds.size;
  const total = state.layout.sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="layout le-layout">
      <div
        ref={rootRef}
        className={cx('le', collapsed && 'drawer-collapsed', drawerOpen && 'drawer-open', hasSel && 'has-sel')}
        style={vars({ '--mm': `${mm}px` })}
        onPointerDown={(e) => engine.onPointerDown(e.nativeEvent)}
        onDragStart={(e) => e.preventDefault()}
        onClick={onClick}
        onKeyDown={(e) => { if (handleKey(e.nativeEvent, { root: rootRef.current as HTMLElement, ...latest.current, openDrawer: setDrawerOpen })) e.preventDefault(); }}
      >
        <header className="le-top">
          <div>
            <h1>Organizar a ficha</h1>
            <small>{system.name}</small>
          </div>
          <div className="le-seg" role="group" aria-label="Modo">
            <button type="button" aria-pressed={editable} onClick={() => setMode('edit')}>Editar</button>
            <button type="button" aria-pressed={!editable} onClick={() => { setMode('preview'); ed.select(null); }}>Prévia da folha</button>
          </div>
          {editable && (
            <div className="le-grp">
              <button type="button" className="le-btn" id="le-undo" disabled={!state.past.length} title="Desfazer (Ctrl+Z)" onClick={ed.undo}>↶ Desfazer</button>
              <button type="button" className="le-btn" id="le-redo" disabled={!state.future.length} title="Refazer (Ctrl+Y)" onClick={ed.redo}>↷ Refazer</button>
              <button type="button" className="le-btn" id="le-add-section" title="Cria uma seção no primeiro espaço livre" onClick={() => addNear()}>+ Seção</button>
              <button type="button" className="le-btn" id="le-auto" title="Posiciona tudo como o aplicativo montaria sozinho (dá para desfazer)" onClick={remakeAutomatic}>Layout automático</button>
              <button type="button" className="le-btn le-drawerbtn" id="le-drawerbtn" onClick={() => setDrawerOpen(true)}>Gaveta ({tray.length})</button>
            </div>
          )}
          <div className="le-grp">
            <label>
              Zoom
              <select aria-label="Zoom da folha" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                <option value={0.75}>75%</option>
                <option value={1}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
              </select>
            </label>
          </div>
          {editable && warnCount > 0 && (
            <button type="button" className="le-btn le-warnbtn" id="le-warn" title="Mostra um campo em que o texto de exemplo não cabe" onClick={() => ed.select({ kind: 'field', id: [...overIds][0] })}>
              ⚠ {warnCount} {warnCount === 1 ? 'campo não cabe' : 'campos não cabem'}
            </button>
          )}
          <div className="le-grp le-right">
            <span className={cx('le-status', dirty && 'dirty')} id="le-status" role="status">
              {saving ? 'Salvando…' : dirty ? 'Alterações não salvas' : version > 0 ? 'Tudo salvo' : 'Layout automático (ainda não salvo)'}
            </span>
            <button type="button" className="le-btn le-primary" id="le-save" disabled={saving || (!dirty && version > 0)} title="Salva o layout deste sistema (Ctrl+S)" onClick={() => void save()}>
              Salvar layout
            </button>
            <Link
              to={`/sistemas/${system.id}`}
              className="le-btn-link"
              onClick={(e) => { if (dirty && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) e.preventDefault(); }}
            >
              ← voltar ao sistema
            </Link>
          </div>
        </header>

        {conflict && (
          <p className="le-banner warn" role="alert" id="le-conflict">
            Este layout foi salvo em outra aba ou dispositivo depois que você o abriu. Para não apagar o trabalho de lá, o seu não foi salvo.{' '}
            <button type="button" className="le-btn" onClick={() => void reloadFromServer()}>Recarregar a versão mais recente (perde o que você fez aqui)</button>{' '}
            <button type="button" className="le-btn" onClick={() => setConflict(false)}>Continuar editando</button>
          </p>
        )}
        {saveError && <p className="le-banner warn" role="alert" id="le-save-error">{saveError}</p>}
        {editable && tray.length > 0 && (
          <p className="le-banner" id="le-tray-banner">
            {tray.length === 1 ? '1 campo do sistema está' : `${tray.length} campos do sistema estão`} na gaveta, fora da folha. Só o que está na folha sai no PDF: arraste {tray.length === 1 ? 'o campo' : 'os campos'} da gaveta para a folha.
          </p>
        )}

        <div className="le-main">
          {editable ? (
            <Drawer
              items={tray} total={tray.length} query={query} onQuery={setQuery} selectedId={selected?.kind === 'field' ? selected.id : null}
              collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onClose={() => setDrawerOpen(false)} onPlace={(aid) => place(aid)}
            />
          ) : <div />}

          <div className="le-stage">
            <p className="le-hint">
              {editable
                ? 'Arraste campos e seções para onde quiser, puxe as alças para mudar o tamanho e guarde na gaveta o que não vai na folha. O espaço que sobrar fica em branco, de propósito. Os textos de exemplo mostram o tamanho da caixa; o PDF avisa se algum texto de verdade não couber.'
                : 'Prévia da folha como sairia no PDF (com textos de exemplo).'}
            </p>
            <div className="le-canvaswrap" ref={wrapRef}>
              <SheetStage
                layout={state.layout} attrs={attrs} selected={selected} editable={editable} overIds={overIds}
                title="Nome do personagem" subtitle={`${system.name} · Jogador: nome`} footer={`Multicompêndio · ${system.name}`}
                onAddPage={() => ed.edit('Página criada', (d) => { addPage(d); }, { toast: true })}
                onRemovePage={(pg) => ed.edit(`Página ${pg} removida`, (d) => removePage(d, pg), { fail: 'Não foi possível remover a página.' })}
                onAddNear={(sid) => addNear(sid)} onDeleteSection={removeSection}
              />
            </div>
            <p className="le-hint" style={{ textAlign: 'center' }}>{state.layout.sections.length} seções · {total} campos na folha · {state.layout.pages} {state.layout.pages === 1 ? 'página' : 'páginas'}</p>
          </div>

          {editable ? (
            <aside className="le-inspector" id="le-inspector" aria-label="Opções do item selecionado">
              <Inspector
                layout={state.layout} attrs={attrs} selected={selected} overIds={overIds} nonce={msg?.id ?? 0} edit={ed.edit} select={ed.select}
                canUndo={state.past.length > 0} onUndo={ed.undo} onClose={() => ed.select(null)} onPlace={place}
              />
            </aside>
          ) : <div />}
        </div>

        {msg && (
          <div className="le-toast" role="status" id="le-toast">
            <span id="le-toast-msg">{msg.text}</span>
            {msg.undoable && <button type="button" id="le-toast-undo" onClick={() => { ed.undo(); ed.dismiss(); }}>Desfazer</button>}
          </div>
        )}
        <div className="le-sr" aria-live="polite">{state.live}</div>
      </div>
    </div>
  );
}
