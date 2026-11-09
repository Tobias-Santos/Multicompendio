import { useState } from 'react';
import { CutFields, DEFAULT_PDF_OPTIONS, PdfOptions, characterPdfPath, pdfFileName, savePdf } from '../api/pdfApi';

const STORAGE_KEY = 'multicompendio.exportacao';

// As escolhas da última exportação ficam guardadas neste navegador, para não repetir a cada ficha.
function loadOptions(): PdfOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PdfOptions> | null;
    if (!saved) return DEFAULT_PDF_OPTIONS;
    return { inventory: saved.inventory !== false, story: saved.story !== false };
  } catch {
    return DEFAULT_PDF_OPTIONS;
  }
}

// Baixa um PDF (e mostra o erro, se der; e o aviso, se algum texto foi cortado por não caber na caixa).
function useDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cut, setCut] = useState<CutFields | null>(null);
  async function run(path: string, filename: string) {
    setBusy(true);
    setError(null);
    setCut(null);
    try {
      setCut(await savePdf(path, filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, cut, run };
}

function CutNotice({ cut }: { cut: CutFields }) {
  const more = cut.total - cut.names.length;
  return (
    <p className="notice" role="status">
      O PDF foi baixado, mas o texto de {cut.total === 1 ? 'um campo' : `${cut.total} campos`} não coube na caixa e foi cortado: {cut.names.join(', ')}
      {more > 0 ? ` e mais ${more}` : ''}. Quem organiza a ficha do sistema pode aumentar essas caixas.
    </p>
  );
}

// Painel "Exportar PDF" da ficha do personagem: o que incluir depois da ficha.
export function CharacterPdfPanel({ characterId, characterName }: { characterId: string; characterName: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PdfOptions>(loadOptions);
  const { busy, error, cut, run } = useDownload();

  const update = (changes: Partial<PdfOptions>) => {
    const next = { ...options, ...changes };
    setOptions(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // sem armazenamento local: as escolhas só valem nesta tela
    }
  };

  return (
    <div className="pdf-export">
      <button
        type="button"
        className="ghost"
        aria-expanded={open}
        aria-controls="painel-exportar-pdf"
        title="Gera um PDF da ficha para imprimir ou guardar."
        onClick={() => setOpen((v) => !v)}
      >
        Exportar PDF
      </button>

      {open && (
        <div id="painel-exportar-pdf" className="pdf-export-panel" role="group" aria-label="Opções do PDF">
          <p className="hint">A ficha sai como o layout do sistema manda, em papel A4.</p>
          <label className="checkbox" title="Inclui a tabela do inventário e o bloco de estatísticas de cada item, depois da ficha.">
            <input type="checkbox" checked={options.inventory} onChange={(e) => update({ inventory: e.target.checked })} />
            Incluir inventário e blocos dos itens
          </label>
          <label className="checkbox" title="Inclui a história de origem, em páginas próprias, depois da ficha.">
            <input type="checkbox" checked={options.story} onChange={(e) => update({ story: e.target.checked })} />
            Incluir a história de origem
          </label>
          <div className="pdf-export-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(characterPdfPath(characterId, options), pdfFileName(characterName, 'ficha'))}
            >
              {busy ? 'Gerando…' : 'Baixar PDF'}
            </button>
          </div>
          {cut && <CutNotice cut={cut} />}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Botão simples: bloco de um item e ficha em branco do sistema.
export function SimplePdfDownload({ label, title, path, filename }: { label: string; title: string; path: string; filename: string }) {
  const { busy, error, run } = useDownload();

  return (
    <div className="pdf-simple">
      <button type="button" className="ghost" disabled={busy} title={title} onClick={() => void run(path, filename)}>
        {busy ? 'Gerando…' : label}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
