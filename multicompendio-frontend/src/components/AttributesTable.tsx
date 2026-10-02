import { useState } from 'react';
import { SystemAttribute } from '../types/system';
import { updateAttribute, deleteAttribute } from '../api/systemsApi';
import { ATTRIBUTE_TYPE_LABELS, ATTRIBUTE_TYPE_ORDER } from '../constants/attributeTypes';

interface Props {
  systemId: string;
  attributes: SystemAttribute[];
  onChanged: (updated: SystemAttribute) => void;
  onDeleted: (attributeId: string) => void;
}

export function AttributesTable({ systemId, attributes, onChanged, onDeleted }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function saveName(attr: SystemAttribute) {
    try {
      const updated = await updateAttribute(systemId, attr.id, { name: draftName });
      onChanged(updated);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function handleDelete(attr: SystemAttribute) {
    if (!confirm(`Excluir o atributo "${attr.name}"?`)) return;
    try {
      await deleteAttribute(systemId, attr.id);
      onDeleted(attr.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  if (attributes.length === 0) {
    return <p className="muted">Nenhum atributo configurado ainda.</p>;
  }

  const groups = ATTRIBUTE_TYPE_ORDER.map((type) => ({
    type,
    items: attributes.filter((a) => a.data_type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {groups.map((group) => (
        <div key={group.type} className="attribute-group">
          <h4>{ATTRIBUTE_TYPE_LABELS[group.type]}</h4>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Mínimo / Máximo</th>
                <th>Opções</th>
                <th>Obrigatório</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((attr) => (
                <tr key={attr.id}>
                  <td>
                    {editingId === attr.id ? (
                      <input
                        value={draftName}
                        title="Nome do atributo, como ele aparecerá na ficha."
                        onChange={(e) => setDraftName(e.target.value)}
                      />
                    ) : (
                      attr.name
                    )}
                  </td>
                  <td>
                    {attr.min_value ?? '—'} / {attr.max_value ?? '—'}
                  </td>
                  <td>{attr.options ? attr.options.join(', ') : '—'}</td>
                  <td>{attr.is_required ? 'sim' : 'não'}</td>
                  <td className="attribute-actions">
                    {editingId === attr.id ? (
                      <button type="button" onClick={() => saveName(attr)}>
                        salvar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(attr.id);
                          setDraftName(attr.name);
                        }}
                      >
                        editar nome
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => handleDelete(attr)}>
                      excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
