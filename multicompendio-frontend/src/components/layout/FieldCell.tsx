import { LayoutAttribute } from '../../layoutCore';

// O conteúdo de um campo na folha, com um valor de exemplo (o editor mostra como a caixa fica; os valores de verdade são de cada personagem).
export function FieldCell({ attr }: { attr: LayoutAttribute }) {
  const label = attr.name;
  switch (attr.type) {
    case 'number':
      return (
        <div className="le-c le-c-num">
          <b className="le-val">12</b>
          <span className="le-lab">{label}</span>
        </div>
      );
    case 'boolean':
      return (
        <div className="le-c le-c-bool">
          <i className="le-box" aria-hidden="true" />
          <span className="le-lab">{label}</span>
        </div>
      );
    case 'longtext':
      return (
        <div className="le-c le-c-long">
          <span className="le-lab">{label}</span>
          <div className="le-area">Texto de exemplo, para mostrar quanto cabe nesta caixa. Quem preencher a ficha escreve aqui.</div>
        </div>
      );
    case 'text_number':
      return (
        <div className="le-c le-c-tn">
          <div className="le-tn-head">
            <span className="le-lab">{label}</span>
            <i className="le-mini">2</i>
          </div>
          <div className="le-area">Texto de exemplo ao lado do número.</div>
        </div>
      );
    default:
      return (
        <div className="le-c le-c-text">
          <span className="le-lab">{label}</span>
          <span className="le-val">{attr.type === 'select' ? 'Opção' : 'Exemplo'}</span>
        </div>
      );
  }
}
