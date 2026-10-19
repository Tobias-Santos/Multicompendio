import { useState } from 'react';
import { SystemAttribute } from '../types/system';
import { updateAttribute, deleteAttribute } from '../api/systemsApi';
import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPE_ORDER,
  groupBySection,
} from '../constants/attributeTypes';

interface Props {
  systemId: string;
  attributes: SystemAttribute[];
  onChanged: (updated: SystemAttribute) => void;
  onDeleted: (attributeId: string) => void;
  readOnly?: boolean; // sistemas só para consulta: sem editar nem excluir
}

// Acima disso, as seções começam recolhidas (só a primeira fica aberta).
const MANY_ATTRIBUTES = 30;

export function AttributesTable({ systemId, attributes, onChanged, onDeleted, readOnly = false }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftSection, setDraftSection] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function saveEdit(attr: SystemAttribute) {
    try {
      // seção vazia tira o atributo da seção
      const updated = await updateAttribute(systemId, attr.id, {
        name: draftName,
        group_name: draftSection,
      });
      onChanged(updated);
      setEditingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function handleDelete(attr: SystemAttribute) {
    if (!confirm(`Excluir o atributo "${attr.name}"?`)) return;
    try {
      await deleteAttribute(systemId, attr.id);
      onDeleted(attr.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  if (attributes.length === 0) {
    return <p className="muted">Nenhum atributo configurado ainda.</p>;
  }

  const existingSections = Array.from(
    new Set(attributes.map((a) => a.group_name).filter((g): g is string => !!g)),
  );

  // Dentro de cada seção (ou do sistema todo, se não houver seções), os atributos
  // ficam separados por tipo.
  function renderTypeGroups(items: SystemAttribute[], keyPrefix: string) {
    return ATTRIBUTE_TYPE_ORDER.map((type) => ({
      type,
      rows: items.filter((a) => a.data_type === type),
    }))
      .filter((g) => g.rows.length > 0)
      .map((group) => {
        // Só as colunas que fazem sentido para o tipo: faixa para números, opções para listas.
        const showRange = group.type === 'number';
        const showOptions = group.type === 'select';

        return (
        <div key={`${keyPrefix}-${group.type}`} className="attribute-group">
          <h4>{ATTRIBUTE_TYPE_LABELS[group.type]}</h4>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                {showRange && <th>Mínimo / Máximo</th>}
                {showOptions && <th>Opções</th>}
                <th>Obrigatório</th>
                {!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((attr) => (
                <tr key={attr.id}>
                  <td>
                    {editingId === attr.id ? (
                      <div className="inline-edit">
                        <input
                          value={draftName}
                          title="Nome do atributo, como ele aparecerá na ficha."
                          onChange={(e) => setDraftName(e.target.value)}
                        />
                        <input
                          list="secoes-existentes"
                          placeholder="Seção"
                          maxLength={80}
                          value={draftSection}
                          title="Seção da ficha em que o atributo aparece. Deixe em branco para não agrupar."
                          onChange={(e) => setDraftSection(e.target.value)}
                        />
                      </div>
                    ) : (
                      attr.name
                    )}
                  </td>
                  {showRange && (
                    <td>
                      {attr.min_value ?? '—'} / {attr.max_value ?? '—'}
                    </td>
                  )}
                  {showOptions && <td>{attr.options ? attr.options.join(', ') : '—'}</td>}
                  <td>{attr.is_required ? 'sim' : 'não'}</td>
                  {!readOnly && (
                    <td className="attribute-actions">
                      {editingId === attr.id ? (
                        <button type="button" onClick={() => saveEdit(attr)}>
                          salvar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(attr.id);
                            setDraftName(attr.name);
                            setDraftSection(attr.group_name ?? '');
                          }}
                        >
                          editar
                        </button>
                      )}
                      <button type="button" className="danger" onClick={() => handleDelete(attr)}>
                        excluir
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      });
  }

  const hasSections = existingSections.length > 0;

  return (
    <>
      {error && <p className="error">{error}</p>}

      <datalist id="secoes-existentes">
        {existingSections.map((section) => (
          <option key={section} value={section} />
        ))}
      </datalist>

      {hasSections
        ? groupBySection(attributes).map(({ section, items }, index) => (
            <details
              key={section || '__sem_secao__'}
              className="attribute-section"
              open={attributes.length <= MANY_ATTRIBUTES || index === 0}
            >
              <summary>
                {section || 'Sem seção'} <span className="muted">· {items.length}</span>
              </summary>
              {renderTypeGroups(items, section || '__sem_secao__')}
            </details>
          ))
        : renderTypeGroups(attributes, 'todos')}
    </>
  );
}
