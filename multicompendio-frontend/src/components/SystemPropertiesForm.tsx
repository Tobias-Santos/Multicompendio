import { useState } from 'react';
import { RpgSystem } from '../types/system';
import { updateSystem } from '../api/systemsApi';

interface Props {
  system: RpgSystem;
  onUpdated: (system: RpgSystem) => void;
}

export function SystemPropertiesForm({ system, onUpdated }: Props) {
  const [description, setDescription] = useState(system.description ?? '');
  const [version, setVersion] = useState(system.version ?? '');
  const [ownerUserId, setOwnerUserId] = useState(system.owner_user_id ?? '');
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
        owner_user_id: ownerUserId || undefined,
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
        Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <label>
        Versão
        <input
          placeholder="ex: 5e, 1.0, Revisado 2024"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
      </label>

      <label>
        Usuário proprietário (ID)
        <input
          placeholder="opcional — sem autenticação ainda"
          value={ownerUserId}
          onChange={(e) => setOwnerUserId(e.target.value)}
        />
      </label>

      <p className="muted">
        Pré-configurado: {system.is_preconfigured ? 'sim' : 'não'}
        <br />
        <small>Esse campo só é definido por sistemas que já vêm com a instalação (RF04) — não é editável aqui.</small>
      </p>

      {error && <p className="error">{error}</p>}
      {saved && !error && <p className="muted">Salvo.</p>}

      <button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar propriedades'}
      </button>
    </form>
  );
}
