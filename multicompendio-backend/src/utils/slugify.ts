// Gera um identificador técnico (key) a partir de um texto legível,
// usado internamente pelo banco/API. O usuário nunca vê nem digita isso —
// é responsabilidade da aplicação, não dele.
export function slugify(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return base || 'atributo';
}

// Garante que a key seja única dentro da lista de keys já existentes,
// adicionando um sufixo numérico em caso de colisão (ex: dois nomes
// diferentes que geram o mesmo slug, como "Força" e "FORCA").
export function uniqueSlug(text: string, existingKeys: string[]): string {
  const base = slugify(text);
  if (!existingKeys.includes(base)) return base;

  let suffix = 2;
  let candidate = `${base}_${suffix}`;
  while (existingKeys.includes(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  return candidate;
}
