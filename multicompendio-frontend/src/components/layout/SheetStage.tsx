import { memo } from 'react';
import {
  AttrIndex, BAR, BAR_GAP, LayoutItem, LayoutSection, SHAPE_LABELS, SHAPE_POLYGONS, SHIELD_PATH, SheetLayout, outerHeight, r1, shapeInsets,
} from '../../layoutCore';
import { FieldCell } from './FieldCell';
import { Selection, TYPE_LABELS, cx, fmt, vars } from './common';
import { LayoutAttribute } from '../../layoutCore';

// A folha: uma página A4 para cada página do layout, com as seções e os campos posicionados em milímetros.
// Só desenha; quem trata os gestos (arrastar, redimensionar) é o motor de arrasto, por delegação, a partir dos data-*.

const HANDLES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

// ATENÇÃO: as medidas (.le-dim, .le-sdim) e o resumo da seção (.le-sec-meta) são UM só nó de texto de propósito: o motor de arrasto
// atualiza esse mesmo nó durante o gesto (veja setText em engine.ts). Vários nós de texto aqui fariam o React falhar ao removê-los.
interface CardProps { item: LayoutItem; attr: LayoutAttribute; sel: boolean; over: boolean; editable: boolean }

const Card = memo(function Card({ item, attr, sel, over, editable }: CardProps) {
  const [il, ir, it, ib] = shapeInsets(item.shape, item.w, item.h);
  const poly = SHAPE_POLYGONS[item.shape];
  const hasSvg = !!poly || item.shape === 'shield';
  const style = vars({
    left: `calc(${item.x} * var(--mm))`,
    top: `calc(${item.y} * var(--mm))`,
    width: `calc(${item.w} * var(--mm))`,
    height: `calc(${item.h} * var(--mm))`,
    '--il': r1(il), '--ir': r1(ir), '--it': r1(it), '--ib': r1(ib),
  });
  const cls = cx('le-card', `le-sh-${item.shape}`, hasSvg && 'svgshape', sel && 'is-sel', over && 'is-over');
  const aria = `${attr.name}, ${TYPE_LABELS[attr.type]}, formato ${SHAPE_LABELS[item.shape].toLowerCase()}, ${fmt(item.w)} por ${fmt(item.h)} milímetros, posição ${fmt(item.x)} e ${fmt(item.y)}`;
  return (
    <div className={cls} style={style} data-field={attr.id} {...(editable ? { role: 'button', tabIndex: 0, 'aria-label': aria } : {})}>
      {hasSvg && (
        <svg className="le-shp" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {poly ? <polygon points={poly.map((p) => p.join(',')).join(' ')} /> : <path d={SHIELD_PATH} />}
        </svg>
      )}
      <FieldCell attr={attr} />
      {editable && (
        <>
          <span className="le-card-grip" title="Arraste para mover" aria-hidden="true">⠿</span>
          {sel && HANDLES.map((h) => <i key={h} className="le-hd" data-h={h} aria-hidden="true" />)}
          <span className="le-dim">{`${fmt(item.w)} × ${fmt(item.h)} mm`}</span>
        </>
      )}
    </div>
  );
}, (a, b) => a.sel === b.sel && a.over === b.over && a.editable === b.editable && a.attr === b.attr
  && a.item.x === b.item.x && a.item.y === b.item.y && a.item.w === b.item.w && a.item.h === b.item.h && a.item.shape === b.item.shape);

interface SectionProps {
  sec: LayoutSection; attrs: AttrIndex; sel: Selection | null; editable: boolean; overIds: Set<string>;
  onAddNear: (id: string) => void; onDelete: (id: string) => void;
}

function Section({ sec, attrs, sel, editable, overIds, onAddNear, onDelete }: SectionProps) {
  const on = sel?.kind === 'sec' && sel.id === sec.id;
  return (
    <section className={cx('le-sec', on && 'is-sel')} data-sec={sec.id} style={vars({ '--sx': sec.x, '--sy': sec.y, '--sw': sec.w })} aria-label={`Seção ${sec.title}`}>
      <div className="le-sec-bar" data-secbar={sec.id} {...(editable ? { tabIndex: 0, role: 'button' } : {})}>
        {editable && <span className="le-sec-grip" data-grip="sec" title="Arraste para mover a seção" aria-hidden="true">⠿</span>}
        <span className="le-sec-title">{sec.title}</span>
        <span className="le-sec-meta">{`${sec.items.length} ${sec.items.length === 1 ? 'campo' : 'campos'}${editable ? ` · ${fmt(sec.w)} × ${fmt(sec.h)} mm` : ''}`}</span>
        {editable && (
          <span className="le-sec-tools">
            <button type="button" title="Criar uma seção no primeiro espaço livre perto desta" aria-label={`Criar seção perto de ${sec.title}`} onClick={() => onAddNear(sec.id)}>+</button>
            <button type="button" title="Remover a seção (os campos vão para a gaveta)" aria-label={`Remover a seção ${sec.title}`} onClick={() => onDelete(sec.id)}>✕</button>
          </span>
        )}
      </div>
      <div className="le-sec-body" data-body={sec.id} style={vars({ '--h': sec.h })}>
        {sec.items.map((it) => {
          const attr = attrs.get(it.attributeId);
          return attr ? <Card key={it.attributeId} item={it} attr={attr} sel={sel?.kind === 'field' && sel.id === it.attributeId} over={overIds.has(it.attributeId)} editable={editable} /> : null;
        })}
      </div>
      {editable && on && HANDLES.map((h) => <i key={h} className="le-hd le-shd" data-h={h} data-sh="1" aria-hidden="true" />)}
      <span className="le-sdim">{`${fmt(sec.w)} × ${fmt(outerHeight(sec))} mm`}</span>
    </section>
  );
}

interface StageProps {
  layout: SheetLayout; attrs: AttrIndex; selected: Selection | null; editable: boolean; overIds: Set<string>;
  title: string; subtitle: string; footer: string;
  onAddPage: () => void; onRemovePage: (page: number) => void; onAddNear: (id: string) => void; onDeleteSection: (id: string) => void;
}

export function SheetStage(p: StageProps) {
  const total = p.layout.pages;
  return (
    <div className={cx('le-pages', p.editable ? 'edit' : 'preview')} id="le-pages">
      {Array.from({ length: total }, (_, i) => i + 1).map((pg) => {
        const empty = !p.layout.sections.some((s) => s.page === pg);
        return (
          <div key={pg}>
            {p.editable && (
              <div className="le-pagelabel">
                <span>Página {pg} de {total}</span>
                {empty && total > 1 && <button type="button" title="Remove esta página vazia" onClick={() => p.onRemovePage(pg)}>Remover página</button>}
              </div>
            )}
            <div className="le-sheet" data-page={pg}>
              {pg === 1 && (
                <header className="le-sheet-head">
                  <h2>{p.title}</h2>
                  <p>{p.subtitle}</p>
                </header>
              )}
              {p.layout.sections.filter((s) => s.page === pg).map((s) => (
                <Section key={s.id} sec={s} attrs={p.attrs} sel={p.selected} editable={p.editable} overIds={p.overIds} onAddNear={p.onAddNear} onDelete={p.onDeleteSection} />
              ))}
              <footer className="le-sheet-foot">
                <span>{p.footer}</span>
                <span>pág. {pg} de {total}</span>
              </footer>
            </div>
          </div>
        );
      })}
      {p.editable && (
        <button type="button" className="le-add-page" title="Cria uma página nova no fim. Dá para soltar uma seção em cima deste botão." onClick={p.onAddPage}>
          + Nova página
        </button>
      )}
    </div>
  );
}

export { BAR, BAR_GAP };
