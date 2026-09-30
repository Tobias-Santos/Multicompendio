import { useState } from 'react';
import { AttributeDataType, AttributeInput } from '../types/system';
import { addAttribute } from '../api/systemsApi';

const empty: AttributeInput = { key: '', label: '', data_type: 'number' };

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
        placeholder="key (ex: forca)"
        value={attr.key}
        onChange={(e) => update({ key: e.target.value })}
        required
      />
      <input
        placeholder="Label (ex: Força)"
        value={attr.label}
        onChange={(e) => update({ label: e.target.value })}
        required
      />
      <select
        value={attr.data_type}
        onChange={(e) => update({ data_type: e.target.value as AttributeDataType })}
      >
        <option value="number">number</option>
        <option value="text">text</option>
        <option value="boolean">boolean</option>
        <option value="select">select</option>
      </select>

      {attr.data_type === 'number' && (
        <>
          <input
            type="number"
            placeholder="min"
            onChange={(e) => update({ min_value: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input
            type="number"
            placeholder="max"
            onChange={(e) => update({ max_value: e.target.value ? Number(e.target.value) : undefined })}
          />
        </>
      )}

      {attr.data_type === 'select' && (
        <input
          placeholder="opções separadas por vírgula"
          value={optionsText}
          onChange={(e) => setOptionsText(e.target.value)}
        />
      )}

      <label className="checkbox">
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
