import { CharacterValues, TextNumberValue } from '../types/character';
import { SystemAttribute } from '../types/system';

interface Props {
  name: string;
  fields: SystemAttribute[];
  values: CharacterValues;
  caption?: string; // linha pequena sob o nome (ex.: quem criou)
}

function format(_field: SystemAttribute, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value);
}

// O item como um "bloco de estatísticas": o nome em destaque e cada campo preenchido, no estilo
// dos livros de RPG. Os campos curtos ficam em linhas "Nome: valor"; os textos longos, em parágrafos.
export function ItemStatBlock({ name, fields, values, caption }: Props) {
  const filled = fields.filter((f) => values[f.id] !== undefined && values[f.id] !== '');
  const isLong = (f: SystemAttribute) => f.data_type === 'longtext' || f.data_type === 'text_number';
  const short = filled.filter((f) => !isLong(f));
  const long = filled.filter(isLong);

  return (
    <article className="stat-block" aria-label={`Bloco de estatísticas: ${name}`}>
      <h3 className="stat-block-name">{name}</h3>
      {caption && <p className="stat-block-caption">{caption}</p>}
      {short.length > 0 && (
        <dl className="stat-block-fields">
          {short.map((field) => (
            <div key={field.id}>
              <dt>{field.name}:</dt> <dd>{format(field, values[field.id])}</dd>
            </div>
          ))}
        </dl>
      )}
      {long.map((field) => {
        const value = values[field.id];
        // texto com número: "Nome 3. descrição"; texto longo: só o nome quando há mais de um
        if (field.data_type === 'text_number' && typeof value === 'object') {
          const pair = value as TextNumberValue;
          return (
            <p key={field.id} className="stat-block-text">
              <strong>
                {field.name}
                {pair.number !== null ? ` ${pair.number.toLocaleString('pt-BR')}` : ''}.
              </strong>{' '}
              {pair.text}
            </p>
          );
        }
        return (
          <p key={field.id} className="stat-block-text">
            {long.length > 1 && <strong>{field.name}. </strong>}
            {String(value)}
          </p>
        );
      })}
      {filled.length === 0 && <p className="stat-block-caption">Nenhum campo preenchido.</p>}
    </article>
  );
}
