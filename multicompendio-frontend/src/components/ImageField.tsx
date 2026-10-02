import { ChangeEvent, useState } from 'react';
import { InfoLabel } from './InfoLabel';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — imagem fica armazenada como texto (base64) no banco

// Guarda tanto um link externo quanto um arquivo enviado pelo usuário:
// o arquivo é convertido para base64 e salvo como texto no mesmo campo
// que guardaria uma URL comum (data:image/...;base64,...), então o
// backend não precisa saber a diferença entre os dois casos.
export function ImageField({ value, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const isUploadedFile = value.startsWith('data:');

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('A imagem precisa ter até 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.onerror = () => setError('Não foi possível ler esse arquivo.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="image-field">
      <label>
        <InfoLabel
          text="Imagem"
          info="Endereço (link) de uma imagem de capa, ou envie um arquivo do seu computador logo abaixo."
        />
        <input
          placeholder="https://..."
          value={isUploadedFile ? '' : value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      <label className="file-field">
        <span className="muted">
          {isUploadedFile ? 'Arquivo selecionado — ' : ''}ou envie um arquivo (até 2MB)
        </span>
        <input
          type="file"
          accept="image/*"
          title="Selecione uma imagem do seu computador para usar como capa."
          onChange={handleFile}
        />
      </label>

      {error && <p className="error">{error}</p>}

      {value && <img src={value} alt="Pré-visualização da capa" className="system-cover-preview" />}
    </div>
  );
}
