import { useState } from 'react';
import { AttributeDataType, AttributeInput } from '../types/system';
import { addAttribute, FieldKind } from '../api/systemsApi';
import {
  ATTRIBUTE_NAME_EXAMPLES,
  ATTRIBUTE_TYPE_LABELS,
  ATTRIBUTE_TYPE_ORDER,
  ITEM_FIELD_NAME_EXAMPLES,
  hasNumberRange,
} from '../constants/attributeTypes';
import { SectionField } from './SectionField';

const empty: AttributeInput = { name: '', data_type: 'number' };

interface Props {
  systemId: string;
  onAdded: () => void;
  sections?: string[]; // seções que o sistema já tem, sugeridas ao digitar
  kind?: FieldKind; // 'item_field': campos dos itens (sem seções)
}

export function AddAttributeForm({ systemId, onAdded, sections = [], kind = 'attribute' }: Props) {
  const isItem = kind === 'item_field';
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
      // só envia o que faz sentido para o tipo escolhido (faixa para números, opções para listas)
      await addAttribute(systemId, {
        ...attr,
        min_value: hasNumberRange(attr.data_type) ? attr.min_value : undefined,
        max_value: hasNumberRange(attr.data_type) ? attr.max_value : undefined,
        options:
          attr.data_type === 'select'
            ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
      }, kind);
      // mantém a seção e a faixa (mínimo e máximo): facilita cadastrar vários atributos parecidos em seguida
      setAttr({ ...empty, group_name: attr.group_name, min_value: attr.min_value, max_value: attr.max_value });
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
        placeholder={`Nome (ex: ${(isItem ? ITEM_FIELD_NAME_EXAMPLES : ATTRIBUTE_NAME_EXAMPLES)[attr.data_type]})`}
        title={isItem ? 'Nome do campo, como ele aparecerá no item.' : 'Nome do atributo, como ele aparecerá na ficha.'}
        value={attr.name}
        onChange={(e) => update({ name: e.target.value })}
        required
      />
      {!isItem && (
        <SectionField
          value={attr.group_name ?? ''}
          onChange={(group_name) => update({ group_name })}
          sections={sections}
        />
      )}
      <select
        value={attr.data_type}
        title={isItem ? 'Tipo de valor que este campo vai guardar.' : 'Tipo de valor que este atributo vai guardar. "Texto com número" guarda um número (opcional, com mínimo e máximo) e um texto.'}
        onChange={(e) => update({ data_type: e.target.value as AttributeDataType })}
      >
        {ATTRIBUTE_TYPE_ORDER.map((type) => (
          <option key={type} value={type}>
            {ATTRIBUTE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>

      {hasNumberRange(attr.data_type) && (
        <>
          <input
            type="number"
            placeholder="Mínimo"
            title="Menor valor permitido para a parte numérica (opcional)."
            value={attr.min_value ?? ''}
            onChange={(e) => update({ min_value: e.target.value ? Number(e.target.value) : undefined })}
          />
          <input
            type="number"
            placeholder="Máximo"
            title="Maior valor permitido para a parte numérica (opcional)."
            value={attr.max_value ?? ''}
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
        {submitting ? 'Adicionando...' : isItem ? '+ adicionar campo' : '+ adicionar atributo'}
      </button>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
