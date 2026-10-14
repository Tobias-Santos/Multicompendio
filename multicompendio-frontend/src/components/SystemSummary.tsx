import { RpgSystem } from '../types/system';
import { ownerLabel } from '../utils/owner';

interface Props {
  system: RpgSystem;
}

// Versão só para leitura das propriedades de um sistema (usada quando a
// pessoa pode consultar mas não alterar, como nos sistemas pré-configurados).
export function SystemSummary({ system }: Props) {
  const rows: Array<[string, string | null]> = [
    ['Descrição', system.description],
    ['Idioma', system.language],
    ['Gênero', system.genre],
    ['Ambientação', system.setting],
    ['Versão', system.version],
    ['Proprietário', ownerLabel(system)],
  ];

  return (
    <div className="card">
      <h2>Sobre o sistema</h2>

      {system.image_url && (
        <img src={system.image_url} alt={`Capa de ${system.name}`} className="system-cover-preview" />
      )}

      <dl className="summary">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>

      <p className="readonly-note">
        {system.is_preconfigured
          ? 'Este sistema já vem com o Multicompêndio e é somente para consulta.'
          : 'Este sistema é somente para consulta.'}
      </p>
    </div>
  );
}
