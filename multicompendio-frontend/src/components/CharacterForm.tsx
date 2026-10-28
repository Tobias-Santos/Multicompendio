import { FormEvent, useState } from 'react';
import { SystemAttribute } from '../types/system';
import { CharacterInput, CharacterValues } from '../types/character';
import { groupBySection } from '../constants/attributeTypes';
import { InfoLabel } from './InfoLabel';

interface Props {
  attributes: SystemAttribute[];
  initialName?: string;
  initialValues?: CharacterValues;
  readOnly?: boolean; // personagem público de outra pessoa: mostra a ficha sem permitir editar
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (input: CharacterInput) => Promise<void>;
}

type FieldState = Record<string, string | boolean>;

// Acima disso, só a primeira seção (e as que têm campo obrigatório) começam abertas.
const MANY_FIELDS = 30;

function buildInitialState(attributes: SystemAttribute[], values?: CharacterValues): FieldState {
  const state: FieldState = {};
  for (const attr of attributes) {
    const value = values?.[attr.id];
    if (attr.data_type === 'boolean') state[attr.id] = value === true;
    else state[attr.id] = value === undefined ? '' : String(value);
  }
  return state;
}

// Texto do balão informativo de cada campo, de acordo com o tipo do atributo.
function hintFor(attr: SystemAttribute): string {
  const min = attr.min_value === null ? null : Number(attr.min_value);
  const max = attr.max_value === null ? null : Number(attr.max_value);

  let hint: string;
  switch (attr.data_type) {
    case 'number':
      if (min !== null && max !== null) hint = `Informe um número entre ${min} e ${max}.`;
      else if (min !== null) hint = `Informe um número a partir de ${min}.`;
      else if (max !== null) hint = `Informe um número até ${max}.`;
      else hint = 'Informe um número.';
      break;
    case 'boolean':
      hint = `Marque se "${attr.name}" vale para este personagem.`;
      break;
    case 'select':
      hint = `Escolha uma das opções para "${attr.name}".`;
      break;
    case 'longtext':
      hint = `Escreva à vontade sobre "${attr.name}". Use Enter para mudar de linha.`;
      break;
    default:
      hint = `Escreva o que quiser sobre "${attr.name}".`;
  }
  return attr.is_required ? `${hint} Preenchimento obrigatório.` : hint;
}

// Formulário de personagem, montado a partir dos atributos do sistema.
// Serve tanto para criar quanto para editar. Atributos com seção ficam em
// blocos recolhíveis; o botão de salvar acompanha a rolagem da página.
export function CharacterForm({
  attributes,
  initialName = '',
  initialValues,
  readOnly = false,
  submitLabel,
  submittingLabel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<FieldState>(() => buildInitialState(attributes, initialValues));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const sections = groupBySection(attributes);
  const hasSections = sections.some((s) => s.section !== '');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    sections.forEach(({ section, items }, index) => {
      open[section] =
        attributes.length <= MANY_FIELDS || index === 0 || items.some((a) => a.is_required);
    });
    return open;
  });

  function setField(attributeId: string, value: string | boolean) {
    setFields((prev) => ({ ...prev, [attributeId]: value }));
    setSaved(false);
  }

  function setAllSections(open: boolean) {
    setOpenSections(Object.fromEntries(sections.map((s) => [s.section, open])));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    // Só envia o que foi preenchido; campos vazios ficam de fora.
    const values: CharacterValues = {};
    for (const attr of attributes) {
      const raw = fields[attr.id];
      if (attr.data_type === 'boolean') {
        values[attr.id] = raw === true;
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        values[attr.id] = attr.data_type === 'number' ? Number(raw) : raw;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({ name, values });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o personagem.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(attr: SystemAttribute) {
    const label = attr.is_required ? `${attr.name} *` : attr.name;
    const value = fields[attr.id];
    const wide = attr.data_type === 'longtext' ? 'field-wide' : undefined;

    return (
      <label key={attr.id} className={wide}>
        <InfoLabel text={label} info={hintFor(attr)} />

        {attr.data_type === 'number' && (
          <input
            type="number"
            step="any"
            min={attr.min_value ?? undefined}
            max={attr.max_value ?? undefined}
            value={value as string}
            aria-required={attr.is_required}
            onChange={(e) => setField(attr.id, e.target.value)}
          />
        )}

        {attr.data_type === 'text' && (
          <input
            value={value as string}
            maxLength={1000}
            aria-required={attr.is_required}
            onChange={(e) => setField(attr.id, e.target.value)}
          />
        )}

        {attr.data_type === 'longtext' && (
          <textarea
            rows={4}
            value={value as string}
            maxLength={5000}
            aria-required={attr.is_required}
            onChange={(e) => setField(attr.id, e.target.value)}
          />
        )}

        {attr.data_type === 'select' && (
          <select
            value={value as string}
            aria-required={attr.is_required}
            onChange={(e) => setField(attr.id, e.target.value)}
          >
            <option value="">Selecione...</option>
            {(attr.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}

        {attr.data_type === 'boolean' && (
          <span className="check-line">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => setField(attr.id, e.target.checked)}
            />
            Sim
          </span>
        )}
      </label>
    );
  }

  // noValidate: a conferência dos campos (obrigatórios, faixas) é feita pelo servidor,
  // com mensagens em português. Assim um campo obrigatório dentro de uma seção recolhida
  // nunca trava o envio em silêncio.
  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <label>
        <InfoLabel text="Nome *" info="Nome do personagem. Preenchimento obrigatório." />
        <input
          value={name}
          maxLength={120}
          aria-required={true}
          disabled={readOnly}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>

      {hasSections && sections.length > 1 && (
        <div className="section-controls">
          <button
            type="button"
            className="ghost"
            title="Abre todas as seções da ficha."
            onClick={() => setAllSections(true)}
          >
            Expandir tudo
          </button>
          <button
            type="button"
            className="ghost"
            title="Fecha todas as seções da ficha."
            onClick={() => setAllSections(false)}
          >
            Recolher tudo
          </button>
        </div>
      )}

      {hasSections ? (
        sections.map(({ section, items }) => (
          <details
            key={section || '__sem_secao__'}
            className="form-section"
            open={openSections[section] ?? true}
            onToggle={(e) => {
              const isOpen = (e.currentTarget as HTMLDetailsElement).open;
              setOpenSections((prev) => (prev[section] === isOpen ? prev : { ...prev, [section]: isOpen }));
            }}
          >
            <summary>
              {section || 'Geral'} <span className="muted">· {items.length} campos</span>
            </summary>
            <fieldset className="plain-fieldset" disabled={readOnly}>
              <div className="character-fields">{items.map(renderField)}</div>
            </fieldset>
          </details>
        ))
      ) : (
        <fieldset className="plain-fieldset" disabled={readOnly}>
          <div className="character-fields">{attributes.map(renderField)}</div>
        </fieldset>
      )}

      {!readOnly && (
      <div className="form-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? submittingLabel : submitLabel}
        </button>
        {error && <span className="error">{error}</span>}
        {saved && !error && <span className="muted">Salvo.</span>}
      </div>
      )}
    </form>
  );
}
