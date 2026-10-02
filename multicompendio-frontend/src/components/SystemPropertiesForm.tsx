import { useState } from 'react';
import { RpgSystem } from '../types/system';
import { updateSystem } from '../api/systemsApi';
import { InfoLabel } from './InfoLabel';
import { ImageField } from './ImageField';

interface Props {
  system: RpgSystem;
  onUpdated: (system: RpgSystem) => void;
}

export function SystemPropertiesForm({ system, onUpdated }: Props) {
  const [description, setDescription] = useState(system.description ?? '');
  const [version, setVersion] = useState(system.version ?? '');
  const [language, setLanguage] = useState(system.language ?? '');
  const [genre, setGenre] = useState(system.genre ?? '');
  const [setting, setSetting] = useState(system.setting ?? '');
  const [imageUrl, setImageUrl] = useState(system.image_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const updated = await updateSystem(system.id, {
        description: description || undefined,
        version: version || undefined,
        language: language || undefined,
        genre: genre || undefined,
        setting: setting || undefined,
        image_url: imageUrl || undefined,
      });
      onUpdated(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Propriedades do sistema</h2>

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

      <label>
        <InfoLabel text="Versão" info="Versão ou edição deste sistema, ex: 5e, 1.0, Revisado 2024." />
        <input value={version} onChange={(e) => setVersion(e.target.value)} />
      </label>

      {/* Proprietário fica oculto por enquanto — volta a aparecer quando
          o cadastro/login de usuários existir de fato. */}

      {error && <p className="error">{error}</p>}
      {saved && !error && <p className="muted">Salvo.</p>}

      <button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar propriedades'}
      </button>
    </form>
  );
}
