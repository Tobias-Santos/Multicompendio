import { CharacterValues } from '../types/character';
import { SystemAttribute } from '../types/system';

interface Props {
  name: string;
  fields: SystemAttribute[];
  values: CharacterValues;
  caption?: string; // linha pequena sob o nome (ex.: quem criou)
}

function format(field: SystemAttribute, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  return String(value);
}

// O item como um "bloco de estatísticas": o nome em destaque e cada campo preenchido, no estilo
// dos livros de RPG. Os campos curtos ficam em linhas "Nome: valor"; os textos longos, em parágrafos.
export function ItemStatBlock({ name, fields, values, caption }: Props) {
  const filled = fields.filter((f) => values[f.id] !== undefined && values[f.id] !== '');
  const short = filled.filter((f) => f.data_type !== 'longtext');
  const long = filled.filter((f) => f.data_type === 'longtext');

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
      {long.map((field) => (
        <p key={field.id} className="stat-block-text">
          {field.data_type === 'longtext' && long.length > 1 && <strong>{field.name}. </strong>}
          {String(values[field.id])}
        </p>
      ))}
      {filled.length === 0 && <p className="stat-block-caption">Nenhum campo preenchido.</p>}
    </article>
  );
}
