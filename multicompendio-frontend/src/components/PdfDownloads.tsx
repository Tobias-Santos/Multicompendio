import { useState } from 'react';
import {
  DEFAULT_PDF_OPTIONS,
  Paper,
  PdfOptions,
  characterPdfPath,
  pdfFileName,
  savePdf,
} from '../api/pdfApi';

const STORAGE_KEY = 'multicompendio.exportacao';

// As escolhas da última exportação ficam guardadas neste navegador, para não repetir a cada ficha.
function loadOptions(): PdfOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PdfOptions> | null;
    if (!saved) return DEFAULT_PDF_OPTIONS;
    return {
      paper: saved.paper === 'letter' ? 'letter' : 'a4',
      inventory: saved.inventory !== false,
      story: saved.story !== false,
      hideEmpty: saved.hideEmpty === true,
    };
  } catch {
    return DEFAULT_PDF_OPTIONS;
  }
}

function PaperSelect({ value, onChange }: { value: Paper; onChange: (paper: Paper) => void }) {
  return (
    <label className="pdf-paper" title="Tamanho do papel para imprimir: A4 ou Carta.">
      <span>Papel</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Paper)}>
        <option value="a4">A4</option>
        <option value="letter">Carta</option>
      </select>
    </label>
  );
}

// Baixa um PDF (e mostra o erro, se der). `build` monta o endereço a partir do papel escolhido.
function useDownload() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, filename: string) {
    setBusy(true);
    setError(null);
    try {
      await savePdf(path, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

// Painel "Exportar PDF" da ficha do personagem: papel e o que incluir.
export function CharacterPdfPanel({ characterId, characterName }: { characterId: string; characterName: string }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PdfOptions>(loadOptions);
  const { busy, error, run } = useDownload();

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
          <PaperSelect value={options.paper} onChange={(paper) => update({ paper })} />
          <label className="checkbox" title="Inclui a tabela do inventário e o bloco de estatísticas de cada item.">
            <input type="checkbox" checked={options.inventory} onChange={(e) => update({ inventory: e.target.checked })} />
            Incluir inventário e blocos dos itens
          </label>
          <label className="checkbox" title="Inclui a história de origem, em páginas próprias.">
            <input type="checkbox" checked={options.story} onChange={(e) => update({ story: e.target.checked })} />
            Incluir a história de origem
          </label>
          <label className="checkbox" title="Não mostra os campos que estão sem valor. Por padrão, todos aparecem, para completar à mão.">
            <input type="checkbox" checked={options.hideEmpty} onChange={(e) => update({ hideEmpty: e.target.checked })} />
            Ocultar campos vazios
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

// Botão simples com a escolha do papel: bloco de um item e ficha em branco do sistema.
export function SimplePdfDownload({
  label,
  title,
  buildPath,
  filename,
}: {
  label: string;
  title: string;
  buildPath: (paper: Paper) => string;
  filename: string;
}) {
  const [paper, setPaper] = useState<Paper>(loadOptions().paper);
  const { busy, error, run } = useDownload();

  return (
    <div className="pdf-simple">
      <PaperSelect
        value={paper}
        onChange={(next) => {
          setPaper(next);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadOptions(), paper: next }));
          } catch {
            // sem armazenamento local: vale só nesta tela
          }
        }}
      />
      <button type="button" className="ghost" disabled={busy} title={title} onClick={() => void run(buildPath(paper), filename)}>
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
