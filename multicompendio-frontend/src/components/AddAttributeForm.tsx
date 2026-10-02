import { useState } from 'react';
import { AttributeDataType, AttributeInput } from '../types/system';
import { addAttribute } from '../api/systemsApi';
import { ATTRIBUTE_NAME_EXAMPLES, ATTRIBUTE_TYPE_LABELS, ATTRIBUTE_TYPE_ORDER } from '../constants/attributeTypes';

const empty: AttributeInput = { name: '', data_type: 'number' };

interface Props {
  systemId: string;
  onAdded: () => void;
}

export function AddAttributeForm({ systemId, onAdded }: Props) {
  const [attr, setAttr] = useState<AttributeInput>({ ...empty });
  const [optionsText, setOptionsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(changes: Partial<AttributeInput>) {
    setAttr((prev) => ({ ...prev, ...changes }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await addAttribute(systemId, {
        ...attr,
        options:
          attr.data_type === 'select'
            ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
      });
      setAttr({ ...empty });
      setOptionsText('');
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="attribute-row">
      <input
        placeholder={`Nome (ex: ${ATTRIBUTE_NAME_EXAMPLES[attr.data_type]})`}
        title="Nome do atributo, como ele aparecerá na ficha."
        value={attr.name}
        onChange={(e) => update({ name: e.target.value })}
        required
      />
      <select
        value={attr.data_type}
        title="Tipo de valor que este atributo vai guardar."
        onChange={(e) => update({ data_type: e.target.value as AttributeDataType })}
      >
        {ATTRIBUTE_TYPE_ORDER.map((type) => (
          <option key={type} value={type}>
            {ATTRIBUTE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      {attr.data_type === 'number' && (
        <>
          <input
            type="number"
            placeholder="Mínimo"
            title="Menor valor permitido para este atributo (opcional)."
            onChange={(e) => update({ min_value: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input
            type="number"
            placeholder="Máximo"
            title="Maior valor permitido para este atributo (opcional)."
            onChange={(e) => update({ max_value: e.target.value ? Number(e.target.value) : undefined })}
          />
        </>
      )}

      {attr.data_type === 'select' && (
        <input
          placeholder="opções separadas por vírgula"
          title="As opções que o usuário poderá escolher, separadas por vírgula."
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
        />
      )}

      <label className="checkbox" title="Marque se o preenchimento deste atributo for obrigatório.">
        <input
          type="checkbox"
          checked={attr.is_required ?? false}
          onChange={(e) => update({ is_required: e.target.checked })}
        />
        obrigatório
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Adicionando...' : '+ adicionar atributo'}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
