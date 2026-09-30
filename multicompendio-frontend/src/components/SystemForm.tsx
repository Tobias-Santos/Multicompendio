import { useState } from 'react';
import { RpgSystem } from '../types/system';
import { createSystem } from '../api/systemsApi';

interface Props {
  onCreated: (system: RpgSystem) => void;
}

// RF01 — cadastro simplificado: só nome + descrição.
// Versão, proprietário, pré-configurado e atributos ficam para a
// página de edição do sistema, depois que ele já existe.
export function SystemForm({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const system = await createSystem({ name, description: description || undefined });
      setName('');
      setDescription('');
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
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Criar sistema'}
      </button>
    </form>
  );
}
