import { useState } from 'react';
import { AttributeDataType, AttributeInput, SystemAttribute } from '../types/system';
import { updateAttribute, deleteAttribute, FieldKind } from '../api/systemsApi';
import {
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPE_ORDER,
  groupBySection,
  hasNumberRange,
} from '../constants/attributeTypes';
import { SectionField } from './SectionField';

interface Props {
  systemId: string;
  attributes: SystemAttribute[];
  onChanged: (updated: SystemAttribute) => void;
  onDeleted: (attributeId: string) => void;
  readOnly?: boolean; // sistemas só para consulta: sem editar nem excluir
  kind?: FieldKind; // 'item_field': os campos dos itens (sem seções)
}

// Acima disso, as seções começam recolhidas (só a primeira fica aberta).
const MANY_ATTRIBUTES = 30;

// O que se edita de um atributo ou campo de item: tudo, menos a ordem.
interface Draft {
  name: string;
  section: string;
  type: AttributeDataType;
  min: string;
  max: string;
  options: string;
  required: boolean;
}

const toDraft = (attr: SystemAttribute): Draft => ({
  name: attr.name,
  section: attr.group_name ?? '',
  type: attr.data_type,
  min: attr.min_value === null || attr.min_value === undefined ? '' : String(Number(attr.min_value)),
  max: attr.max_value === null || attr.max_value === undefined ? '' : String(Number(attr.max_value)),
  options: attr.options ? attr.options.join(', ') : '',
  required: attr.is_required,
});

export function AttributesTable({ systemId, attributes, onChanged, onDeleted, readOnly = false, kind = 'attribute' }: Props) {
  const word = kind === 'item_field' ? 'campo' : 'atributo';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (changes: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...changes } : prev));

  function startEdit(attr: SystemAttribute) {
    setEditingId(attr.id);
    setDraft(toDraft(attr));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEditError(null);
  }

  async function saveEdit(attr: SystemAttribute) {
    if (!draft) return;
    const parse = (raw: string, label: string): number | null | undefined => {
      if (raw.trim() === '') return null; // vazio: sem limite
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setEditError(`O valor ${label} precisa ser um número.`);
        return undefined;
      }
      return n;
    };

    const changes: Partial<AttributeInput> = {
      name: draft.name,
      data_type: draft.type,
      is_required: draft.required,
    };
    if (hasNumberRange(draft.type)) {
      const min = parse(draft.min, 'mínimo');
      const max = parse(draft.max, 'máximo');
      if (min === undefined || max === undefined) return;
      changes.min_value = min;
      changes.max_value = max;
    } else {
      changes.min_value = null;
      changes.max_value = null;
    }
    if (draft.type === 'select') {
      changes.options = draft.options.split(',').map((s) => s.trim()).filter(Boolean);
    }
    // seção vazia tira o atributo da seção (os campos de item não têm seções)
    if (kind === 'attribute') changes.group_name = draft.section;

    setSaving(true);
    setEditError(null);
    try {
      onChanged(await updateAttribute(systemId, attr.id, changes, kind));
      cancelEdit();
      setError(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(attr: SystemAttribute) {
    if (!confirm(`Excluir o ${word} "${attr.name}"?`)) return;
    try {
      await deleteAttribute(systemId, attr.id, kind);
      onDeleted(attr.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  if (attributes.length === 0) {
    return <p className="muted">Nenhum {word} configurado ainda.</p>;
  }

  const existingSections = Array.from(
    new Set(attributes.map((a) => a.group_name).filter((g): g is string => !!g)),
  );

  function renderEditPanel(attr: SystemAttribute, columns: number) {
    if (!draft) return null;
    return (
      <tr key={`${attr.id}-edicao`} className="attribute-edit-row">
        <td colSpan={columns}>
          <div className="attribute-edit-panel" role="group" aria-label={`Editar o ${word} ${attr.name}`}>
            <label>
              <span>Nome</span>
              <input
                value={draft.name}
                maxLength={120}
                title={`Nome do ${word}, como ele aparecerá ${kind === 'item_field' ? 'no item' : 'na ficha'}.`}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>

            {kind === 'attribute' && (
              <label className="attribute-edit-wide">
                <span>Seção</span>
                <SectionField value={draft.section} onChange={(section) => patch({ section })} sections={existingSections} />
              </label>
            )}

            <label>
              <span>Tipo</span>
              <select
                value={draft.type}
                title={`Tipo de valor que este ${word} guarda. Só dá para mudar o tipo enquanto nada estiver usando este ${word}.`}
                onChange={(e) => patch({ type: e.target.value as AttributeDataType })}
              >
                {ATTRIBUTE_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {ATTRIBUTE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            {hasNumberRange(draft.type) && (
              <>
                <label>
                  <span>Mínimo</span>
                  <input
                    type="number"
                    value={draft.min}
                    placeholder="sem limite"
                    title="Menor valor permitido para o número (opcional). Deixe em branco para não ter limite."
                    onChange={(e) => patch({ min: e.target.value })}
                  />
                </label>
                <label>
                  <span>Máximo</span>
                  <input
                    type="number"
                    value={draft.max}
                    placeholder="sem limite"
                    title="Maior valor permitido para o número (opcional). Deixe em branco para não ter limite."
                    onChange={(e) => patch({ max: e.target.value })}
                  />
                </label>
              </>
            )}

            {draft.type === 'select' && (
              <label className="attribute-edit-wide">
                <span>Opções (separadas por vírgula)</span>
                <input
                  value={draft.options}
                  title="As opções que poderão ser escolhidas, separadas por vírgula. Não dá para remover uma opção que já esteja em uso."
                  onChange={(e) => patch({ options: e.target.value })}
                />
              </label>
            )}

            <label className="checkbox" title={`Marque se o preenchimento deste ${word} for obrigatório.`}>
              <input type="checkbox" checked={draft.required} onChange={(e) => patch({ required: e.target.checked })} />
              obrigatório
            </label>

            {editError && <p className="error attribute-edit-wide" role="alert">{editError}</p>}

            <div className="attribute-edit-actions attribute-edit-wide">
              <button type="button" disabled={saving} onClick={() => saveEdit(attr)}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" className="ghost" disabled={saving} onClick={cancelEdit}>
                Cancelar
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

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
        const showRange = hasNumberRange(group.type);
        const showOptions = group.type === 'select';
        const columns = 2 + (showRange ? 1 : 0) + (showOptions ? 1 : 0) + (readOnly ? 0 : 1);

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
              {group.rows.flatMap((attr) => {
                const editing = editingId === attr.id;
                const row = (
                  <tr key={attr.id}>
                    <td>{attr.name}</td>
                    {showRange && (
                      <td>
                        {attr.min_value ?? '—'} / {attr.max_value ?? '—'}
                      </td>
                    )}
                    {showOptions && <td>{attr.options ? attr.options.join(', ') : '—'}</td>}
                    <td>{attr.is_required ? 'sim' : 'não'}</td>
                    {!readOnly && (
                      <td className="attribute-actions">
                        <button type="button" onClick={() => (editing ? cancelEdit() : startEdit(attr))}>
                          {editing ? 'fechar' : 'editar'}
                        </button>
                        <button type="button" className="danger" onClick={() => handleDelete(attr)}>
                          excluir
                        </button>
                      </td>
                    )}
                  </tr>
                );
                return editing ? [row, renderEditPanel(attr, columns)] : [row];
              })}
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
