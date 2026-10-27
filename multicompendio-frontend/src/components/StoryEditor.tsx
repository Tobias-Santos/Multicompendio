import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import { MAX_STORY_LENGTH, StoryDocument } from '../types/story';
import { StoryAutosaver, SaveStatus } from '../story/StoryAutosaver';

// O que o editor recebe ao abrir: a história salva e, se houver, um rascunho local.
export interface InitialStory {
  content: StoryDocument | null;
  revision: number;
  updatedAt: string | null;
  recoveredDraft: StoryDocument | null; // rascunho não enviado, baseado na revisão atual: é reaproveitado
  conflictDraft: StoryDocument | null; // rascunho baseado em uma revisão antiga: a pessoa decide
}

const EMPTY_DOC: StoryDocument = { type: 'doc', content: [{ type: 'paragraph' }] };

const formatTime = (date: Date) => date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Salvo',
  dirty: 'Alterações ainda não salvas…',
  saving: 'Salvando…',
  retrying: 'Sem conexão: vamos tentar de novo',
  invalid: 'Não foi possível salvar',
  conflict: 'Salvamento pausado',
};
const STATUS_ICON: Record<SaveStatus, string> = {
  saved: '✓',
  dirty: '•',
  saving: '…',
  retrying: '⚠',
  invalid: '⚠',
  conflict: '⚠',
};

interface ToolbarButtonProps {
  label: string; // nome curto, visível
  title: string; // dica ao passar o mouse (e nome acessível)
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}

function ToolbarButton({ label, title, active, disabled, onClick, className = '', children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`tb-btn ${className}`}
      title={title}
      aria-label={title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // mouseDown: não deixa o botão tirar o foco do texto antes de aplicar o comando
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children ?? label}
    </button>
  );
}

export function StoryEditor({ characterId, initial }: { characterId: string; initial: InitialStory }) {
  const editorRef = useRef<Editor | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [readMode, setReadMode] = useState(false);

  // O controlador é criado uma vez; as funções abaixo só são chamadas depois que o editor existe.
  const [saver] = useState(
    () =>
      new StoryAutosaver({
        characterId,
        revision: initial.revision,
        savedAt: initial.updatedAt ? new Date(initial.updatedAt) : null,
        startDirty: initial.recoveredDraft !== null,
        conflictDraft: initial.conflictDraft,
        getDoc: () => (editorRef.current ? editorRef.current.getJSON() : EMPTY_DOC),
        replaceDoc: (doc) => {
          editorRef.current?.commands.setContent(doc ?? EMPTY_DOC, { emitUpdate: false });
        },
      }),
  );

  useEffect(() => {
    saver.start();
    return () => saver.stop();
  }, [saver]);

  const editor = useEditor({
    // Só o que o servidor aceita e o PDF sabe desenhar: sem links, código, riscado, sublinhado,
    // cores, tabelas ou imagens. Títulos em 2 níveis.
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        code: false,
        codeBlock: false,
        strike: false,
        link: false,
        underline: false,
        trailingNode: false,
      }),
      CharacterCount.configure({ limit: MAX_STORY_LENGTH }),
      Placeholder.configure({ placeholder: 'Conte a origem do personagem: onde nasceu, o que o marcou, o que ele quer…' }),
    ],
    content: initial.recoveredDraft ?? initial.content ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class: 'story-prose',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Texto da história de origem',
        lang: 'pt-BR',
        spellcheck: 'true',
      },
    },
    // só conta quando o documento realmente mudou (e não, por exemplo, ao trocar para o modo leitura)
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) saver.notifyChange();
    },
    onBlur: ({ event }) => {
      // sair do texto para a barra de formatação não conta: só ao sair do editor de vez
      const next = (event as FocusEvent).relatedTarget as Node | null;
      if (next && wrapperRef.current?.contains(next)) return;
      saver.saveNow();
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    // o segundo argumento evita que a troca de modo seja tratada como uma alteração do texto
    editor?.setEditable(!readMode, false);
  }, [editor, readMode]);

  const ui = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            h1: e.isActive('heading', { level: 1 }),
            h2: e.isActive('heading', { level: 2 }),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            quote: e.isActive('blockquote'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            chars: e.storage.characterCount.characters() as number,
            words: e.storage.characterCount.words() as number,
          }
        : null,
  });

  const save = useSyncExternalStore(saver.subscribe, saver.getState);
  const [recoveredDismissed, setRecoveredDismissed] = useState(false);

  if (!editor || !ui) return <p className="muted">Carregando o editor…</p>;

  const run = () => editor.chain().focus();
  const nearLimit = ui.chars >= MAX_STORY_LENGTH * 0.9;
  const atLimit = ui.chars >= MAX_STORY_LENGTH;

  return (
    <div
      className="story-editor"
      ref={wrapperRef}
      onKeyDown={(event) => {
        // Ctrl+S (ou ⌘+S) salva agora, em vez de abrir "Salvar página" do navegador
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          saver.saveNow();
        }
      }}
    >
      {save.status === 'conflict' && (
        <div className="story-banner story-banner-alert" role="alert">
          <p>
            <strong>Há duas versões desta história.</strong> {save.message} O salvamento automático foi pausado para
            não apagar nada sem você saber. Qual versão você quer manter?
          </p>
          {/* os dois botões têm o mesmo peso: cada escolha descarta uma das versões */}
          <div className="story-banner-actions">
            <button
              type="button"
              className="ghost"
              title="Descarta o que está nesta tela e carrega a versão que está salva."
              onClick={() => void saver.adoptServerVersion()}
            >
              Usar a versão salva
            </button>
            <button
              type="button"
              className="ghost"
              title="Mantém o texto desta tela e substitui a versão que está salva."
              onClick={() => saver.keepMine()}
            >
              Manter a minha versão
            </button>
          </div>
        </div>
      )}

      {(save.status === 'retrying' || save.status === 'invalid') && (
        <div className="story-banner story-banner-alert" role="alert">
          <p>{save.message}</p>
          {save.status === 'invalid' && <p className="muted">Ajuste o texto e o salvamento automático volta sozinho.</p>}
        </div>
      )}

      {/* fica até a pessoa dispensar: some sozinho em ~1 s seria rápido demais para ler */}
      {initial.recoveredDraft !== null && !recoveredDismissed && (
        <div className="story-banner" role="status">
          <p>
            Recuperamos alterações que não tinham sido enviadas da última vez.{' '}
            {save.status === 'saved' ? 'Elas já estão salvas.' : 'Estamos salvando agora.'}
          </p>
          <button type="button" className="ghost" onClick={() => setRecoveredDismissed(true)}>
            Entendi
          </button>
        </div>
      )}

      <div className="story-topline">
        <p className="muted story-hint">
          Escreva livremente: o texto é salvo sozinho enquanto você digita, e fica junto do personagem.
        </p>
        <button
          type="button"
          className="ghost story-read-toggle"
          aria-pressed={readMode}
          title={readMode ? 'Voltar a editar o texto.' : 'Ver o texto como leitura, sem a barra de formatação.'}
          onClick={() => setReadMode((v) => !v)}
        >
          {readMode ? 'Editar' : 'Modo leitura'}
        </button>
      </div>

      {!readMode && (
        <div className="story-toolbar" role="toolbar" aria-label="Formatação do texto">
          <ToolbarButton label="" title="Negrito (Ctrl+B)" active={ui.bold} onClick={() => run().toggleBold().run()}>
            <strong>N</strong>
          </ToolbarButton>
          <ToolbarButton label="" title="Itálico (Ctrl+I)" active={ui.italic} onClick={() => run().toggleItalic().run()}>
            <em>I</em>
          </ToolbarButton>
          <span className="tb-sep" aria-hidden="true" />
          <ToolbarButton
            label="Título"
            title="Título grande (Ctrl+Alt+1)"
            active={ui.h1}
            onClick={() => run().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            label="Subtítulo"
            title="Subtítulo (Ctrl+Alt+2)"
            active={ui.h2}
            onClick={() => run().toggleHeading({ level: 2 }).run()}
          />
          <span className="tb-sep" aria-hidden="true" />
          <ToolbarButton
            label="Lista"
            title="Lista com marcadores (Ctrl+Shift+8)"
            active={ui.bullet}
            onClick={() => run().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numerada"
            title="Lista numerada (Ctrl+Shift+7)"
            active={ui.ordered}
            onClick={() => run().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Citação"
            title="Citação, para falas e inscrições do mundo (Ctrl+Shift+B)"
            active={ui.quote}
            onClick={() => run().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="Separador"
            title="Linha separadora entre cenas"
            onClick={() => run().setHorizontalRule().run()}
          />
          <span className="tb-sep" aria-hidden="true" />
          <ToolbarButton label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!ui.canUndo} onClick={() => run().undo().run()} />
          <ToolbarButton label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!ui.canRedo} onClick={() => run().redo().run()} />
        </div>
      )}

      <EditorContent editor={editor} className={`story-surface${readMode ? ' story-reading' : ''}`} />

      <div className="story-footer">
        <p className={`story-status story-status-${save.status}`}>
          <span aria-hidden="true">{STATUS_ICON[save.status]} </span>
          {save.status === 'saved'
            ? save.lastSavedAt
              ? `Salvo às ${formatTime(save.lastSavedAt)}`
              : 'As alterações são salvas automaticamente.'
            : STATUS_LABEL[save.status]}
        </p>
        <p className={`story-count${nearLimit ? ' story-count-warn' : ''}`}>
          {nearLimit && <span aria-hidden="true">⚠ </span>}
          {ui.chars.toLocaleString('pt-BR')} / {MAX_STORY_LENGTH.toLocaleString('pt-BR')} caracteres ·{' '}
          {ui.words.toLocaleString('pt-BR')} palavras
          {atLimit && ' · limite atingido'}
        </p>
        <button
          type="button"
          className="ghost story-save-now"
          title="Salvar agora (Ctrl+S). O salvamento automático já faz isso sozinho."
          disabled={save.status === 'saved' || save.status === 'conflict'}
          onClick={() => saver.saveNow()}
        >
          Salvar agora
        </button>
      </div>
    </div>
  );
}
