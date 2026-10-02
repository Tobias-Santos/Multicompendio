interface Props {
  text: string;
  info: string;
}

// Usa o atributo title nativo do navegador — já é o "balão informativo"
// que aparece ao passar o mouse, sem precisar de JS extra.
export function InfoLabel({ text, info }: Props) {
  return (
    <span className="info-label">
      {text}
      <span className="info-icon" title={info} aria-label={info}>
        ⓘ
      </span>
    </span>
  );
}
