import { useState } from 'react';
import { SystemAttribute } from '../types/system';
import { updateAttribute } from '../api/systemsApi';

interface Props {
  systemId: string;
  attributes: SystemAttribute[];
  onChanged: (updated: SystemAttribute) => void;
}

export function AttributesTable({ systemId, attributes, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function saveLabel(attr: SystemAttribute) {
    try {
      const updated = await updateAttribute(systemId, attr.id, { label: draftLabel });
      onChanged(updated);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  if (attributes.length === 0) {
    return <p className="muted">Nenhum atributo configurado ainda.</p>;
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>key</th>
            <th>label</th>
            <th>tipo</th>
            <th>min/max</th>
            <th>opções</th>
            <th>obrigatório</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {attributes.map((attr) => (
            <tr key={attr.id}>
              <td>{attr.key}</td>
              <td>
                {editingId === attr.id ? (
                  <input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
                ) : (
                  attr.label
                )}
              </td>
              <td>{attr.data_type}</td>
              <td>
                {attr.min_value ?? '—'} / {attr.max_value ?? '—'}
              </td>
              <td>{attr.options ? attr.options.join(', ') : '—'}</td>
              <td>{attr.is_required ? 'sim' : 'não'}</td>
              <td>
                {editingId === attr.id ? (
                  <button type="button" onClick={() => saveLabel(attr)}>
                    salvar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(attr.id);
                      setDraftLabel(attr.label);
                    }}
                  >
                    editar label
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
