interface Props {
  value: string;
  onChange: (value: string) => void;
  sections: string[]; // seções que já existem no sistema
  placeholder?: string;
  title?: string;
}

// Campo de seção: dá para escrever uma seção nova normalmente ou escolher uma que já existe na lista ao lado.
export function SectionField({ value, onChange, sections, placeholder = 'Seção (ex: Combate)', title }: Props) {
  return (
    <div className="section-field">
      <input
        placeholder={placeholder}
        title={title ?? 'Agrupa atributos parecidos na ficha, como Combate ou Magias. Escreva uma seção nova ou escolha uma da lista. Deixe em branco para não agrupar.'}
        maxLength={80}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <select
        value=""
        disabled={sections.length === 0}
        aria-label="Escolher uma seção que já existe"
        title={sections.length === 0 ? 'Este sistema ainda não tem seções.' : 'Escolha uma seção que já existe neste sistema.'}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      >
        <option value="">{sections.length === 0 ? 'Sem seções' : 'Seções existentes…'}</option>
        {sections.map((section) => (
          <option key={section} value={section}>
            {section}
          </option>
        ))}
      </select>
    </div>
  );
}
