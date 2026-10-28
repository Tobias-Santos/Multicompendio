import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { StoryDocument } from '../types/story';

// Mostra a história de outra pessoa (personagem público): só leitura, sem barra nem salvamento.
export function StoryReader({ content }: { content: StoryDocument | null }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] }, code: false, codeBlock: false, strike: false, link: false, underline: false, trailingNode: false }),
    ],
    content: content ?? undefined,
    editable: false,
    editorProps: { attributes: { class: 'story-prose', 'aria-label': 'História de origem, somente leitura', lang: 'pt-BR' } },
  });

  if (!editor) return null;
  if (editor.isEmpty) return <p className="muted">Esta pessoa ainda não escreveu a história deste personagem.</p>;
  return <EditorContent editor={editor} className="story-surface story-reading story-reader" />;
}
