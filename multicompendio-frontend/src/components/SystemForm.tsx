import { useState } from 'react';
import { RpgSystem } from '../types/system';
import { createSystem } from '../api/systemsApi';
import { InfoLabel } from './InfoLabel';
import { ImageField } from './ImageField';

interface Props {
  onCreated: (system: RpgSystem) => void;
}

// RF01 — cadastro: nome, descrição e metadados narrativos (idioma,
// gênero, ambientação, imagem). Versão, proprietário, pré-configurado
// e atributos ficam para a página de edição do sistema.
export function SystemForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [genre, setGenre] = useState('');
  const [setting, setSetting] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const system = await createSystem({
        name,
        description: description || undefined,
        language: language || undefined,
        genre: genre || undefined,
        setting: setting || undefined,
        image_url: imageUrl || undefined,
      });
      setName('');
      setDescription('');
      setLanguage('');
      setGenre('');
      setSetting('');
      setImageUrl('');
      onCreated(system);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Novo sistema de RPG</h2>

      <label>
        <InfoLabel text="Nome" info="Nome do sistema de RPG. Precisa ser único." />
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        <InfoLabel text="Descrição" info="Breve descrição do sistema: proposta, estilo de jogo, tom." />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>
        <InfoLabel text="Idioma" info="Idioma principal do sistema, ex: Português, Inglês." />
        <input value={language} onChange={(e) => setLanguage(e.target.value)} />
      </label>

      <label>
        <InfoLabel text="Gênero" info="Gênero narrativo do sistema, ex: Fantasia, Terror, Ficção científica." />
        <input value={genre} onChange={(e) => setGenre(e.target.value)} />
      </label>

      <label>
        <InfoLabel text="Ambientação" info="Cenário ou universo em que as histórias deste sistema se passam." />
        <textarea value={setting} onChange={(e) => setSetting(e.target.value)} />
      </label>

      <ImageField value={imageUrl} onChange={setImageUrl} />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Criar sistema'}
      </button>
    </form>
  );
}
