interface Props {
  className?: string;
  // Em telas estreitas, troca a logo completa pelo ícone (o "M"), que ocupa bem menos espaço.
  compact?: boolean;
}

// A marca do Multicompêndio. Usa WebP (bem mais leve) com PNG de reserva.
export function BrandLogo({ className = '', compact = false }: Props) {
  return (
    <>
      <picture>
        <source srcSet="/logo.webp" type="image/webp" />
        <img
          src="/logo.png"
          alt="Multicompêndio"
          width={1000}
          height={219}
          className={`brand-full ${className}`}
        />
      </picture>
      {compact && (
        <picture>
          <source srcSet="/icon-128.webp" type="image/webp" />
          <img src="/icon-128.png" alt="Multicompêndio" width={128} height={128} className="brand-icon" />
        </picture>
      )}
    </>
  );
}
