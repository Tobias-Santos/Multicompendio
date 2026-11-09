// Garante que o núcleo do layout (src/layoutCore) é idêntico no back-end e no front-end.
// Uso:  node tools/core-checksum.mjs          confere a pasta com o CHECKSUM.txt
//       node tools/core-checksum.mjs --write  recalcula o CHECKSUM.txt (depois de mexer no núcleo; copie a pasta para o outro projeto)
// O fim de linha (Windows ou Linux) não conta.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dir = new URL('../src/layoutCore/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).sort();
const hash = createHash('sha256');
for (const f of files) {
  hash.update(`${f}\n`);
  hash.update(readFileSync(new URL(f, dir), 'utf8').replace(/\r\n/g, '\n'));
}
const sum = hash.digest('hex');
const text = `sha256 ${sum}\n${files.join('\n')}\n`;

if (process.argv.includes('--write')) {
  writeFileSync(new URL('CHECKSUM.txt', dir), text);
  console.log('CHECKSUM.txt atualizado:', sum.slice(0, 12));
} else {
  const saved = readFileSync(new URL('CHECKSUM.txt', dir), 'utf8').replace(/\r\n/g, '\n');
  if (saved !== text) {
    console.error('O núcleo do layout (src/layoutCore) não bate com o CHECKSUM.txt.');
    console.error('Se a mudança foi de propósito: rode "node tools/core-checksum.mjs --write" e copie a pasta src/layoutCore inteira para o outro projeto (back-end e front-end).');
    process.exit(1);
  }
  console.log('núcleo do layout íntegro:', sum.slice(0, 12));
}
