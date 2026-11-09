import { useCallback, useMemo, useReducer } from 'react';
import { SheetLayout } from '../../layoutCore';
import { Selection } from './common';

// Estado do editor: o layout, o histórico (desfazer e refazer), a seleção e os avisos.
// Toda alteração passa por "edit": a função recebe um rascunho (cópia do layout), mexe nele com as operações do núcleo e diz se deu certo.

export interface EditorMessage { id: number; text: string; undoable: boolean }

export interface EditorState {
  layout: SheetLayout;
  past: SheetLayout[];
  future: SheetLayout[];
  saved: string; // o layout que está no servidor, em texto (para saber se há alterações não salvas)
  selected: Selection | null;
  last: { key: string; at: number } | null; // para juntar passos seguidos (setas) num só no histórico
  message: EditorMessage | null;
  live: string; // anúncio para leitores de tela
  counter: number;
}

// O que a função de edição pode devolver: nada/true (deu certo), false (recusado) ou um aviso junto do resultado.
export type EditResult = boolean | void | { notice: string } | { fail: string };
export type EditFn = (draft: SheetLayout) => EditResult;
export interface EditOptions {
  coalesce?: string; // passos seguidos com a mesma chave (em até 0,7 s) viram um só
  select?: Selection | null; // nova seleção depois da edição (se omitido, mantém)
  toast?: boolean; // mostra o rótulo como aviso na tela
  undoable?: boolean; // o aviso oferece "Desfazer"
  fail?: string; // mensagem se a edição for recusada
}

type Action =
  | { type: 'edit'; label: string; fn: EditFn; opts: EditOptions; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; selected: Selection | null }
  | { type: 'load'; layout: SheetLayout; saved: boolean }
  | { type: 'saved'; layout: SheetLayout }
  | { type: 'say'; text: string }
  | { type: 'dismiss' };

const clone = (l: SheetLayout): SheetLayout => JSON.parse(JSON.stringify(l)) as SheetLayout;
const HISTORY = 100;

function keepSelection(layout: SheetLayout, s: Selection | null): Selection | null {
  if (s && s.kind === 'sec' && !layout.sections.some((x) => x.id === s.id)) return null;
  return s;
}

function say(state: EditorState, text: string, undoable = false): EditorState {
  return { ...state, message: { id: state.counter + 1, text, undoable }, live: text, counter: state.counter + 1 };
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'edit': {
      const draft = clone(state.layout);
      const result = action.fn(draft);
      if (result === false || (typeof result === 'object' && result !== null && 'fail' in result)) {
        const text = typeof result === 'object' && result !== null && 'fail' in result ? result.fail : action.opts.fail ?? 'Não foi possível fazer isso.';
        return say(state, text);
      }
      const coalesce = !!action.opts.coalesce && state.last?.key === action.opts.coalesce && action.at - state.last.at < 700;
      const past = coalesce ? state.past : [...state.past, state.layout].slice(-HISTORY);
      const selected = 'select' in action.opts ? action.opts.select ?? null : state.selected;
      const next: EditorState = {
        ...state,
        layout: draft,
        past,
        future: [],
        selected: keepSelection(draft, selected),
        last: action.opts.coalesce ? { key: action.opts.coalesce, at: action.at } : null,
        live: action.label,
      };
      if (typeof result === 'object' && result !== null && 'notice' in result) return say(next, result.notice);
      return action.opts.toast ? say(next, action.label, !!action.opts.undoable) : next;
    }
    case 'undo': {
      if (!state.past.length) return state;
      const layout = state.past[state.past.length - 1];
      return say({ ...state, layout, past: state.past.slice(0, -1), future: [state.layout, ...state.future], selected: keepSelection(layout, state.selected), last: null }, 'Desfeito');
    }
    case 'redo': {
      if (!state.future.length) return state;
      const layout = state.future[0];
      return say({ ...state, layout, past: [...state.past, state.layout], future: state.future.slice(1), selected: keepSelection(layout, state.selected), last: null }, 'Refeito');
    }
    case 'select':
      return { ...state, selected: action.selected };
    case 'load':
      return { ...state, layout: action.layout, past: [], future: [], saved: action.saved ? JSON.stringify(action.layout) : state.saved, selected: keepSelection(action.layout, state.selected), last: null };
    case 'saved':
      return { ...state, saved: JSON.stringify(action.layout) };
    case 'say':
      return say(state, action.text);
    case 'dismiss':
      return { ...state, message: null };
    default:
      return state;
  }
}

export function useLayoutEditor(initial: SheetLayout) {
  const [state, dispatch] = useReducer(reducer, initial, (l): EditorState => ({
    layout: l, past: [], future: [], saved: JSON.stringify(l), selected: null, last: null, message: null, live: '', counter: 0,
  }));
  const edit = useCallback((label: string, fn: EditFn, opts: EditOptions = {}) => dispatch({ type: 'edit', label, fn, opts, at: Date.now() }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const select = useCallback((selected: Selection | null) => dispatch({ type: 'select', selected }), []);
  const load = useCallback((layout: SheetLayout, saved: boolean) => dispatch({ type: 'load', layout, saved }), []);
  const markSaved = useCallback((layout: SheetLayout) => dispatch({ type: 'saved', layout }), []);
  const say_ = useCallback((text: string) => dispatch({ type: 'say', text }), []);
  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), []);
  const dirty = useMemo(() => JSON.stringify(state.layout) !== state.saved, [state.layout, state.saved]);
  return { state, dirty, edit, undo, redo, select, load, markSaved, say: say_, dismiss };
}

export type Editor = ReturnType<typeof useLayoutEditor>;
export type EditFnType = Editor['edit'];
